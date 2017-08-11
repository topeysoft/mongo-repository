"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require('fs');
const mongodb_1 = require("mongodb");
const name_sanitizer_1 = require("./sanitizers/name.sanitizer");
const base_model_1 = require("./models/base-model");
const shortid = require('shortid');
let Grid = require('gridfs');
class Repository {
    static initialize(options = { connectionUrl: '', force: false, fileBucketName: 'my-files-bucket' }) {
        if (!Repository._db || options.force) {
            mongodb_1.MongoClient.connect(options.connectionUrl, (err, database) => {
                if (err)
                    return console.error("MongoDB Connection error:", err.message);
                Repository._db = database;
                Repository._bucketName = options.fileBucketName || "my_file_bucket";
            });
        }
    }
    static getBucket(bucketName) {
        bucketName = bucketName || Repository._bucketName;
        return new mongodb_1.GridFSBucket(Repository._db, { bucketName: bucketName });
    }
    static getCollection(collectionName) {
        return Repository._db.collection(collectionName);
    }
    static getOne(collectionName, query = {}, fields = {}) {
        return new Promise((resolve, reject) => {
            var options = {};
            options.fields = fields;
            Repository._db.collection(collectionName).findOne(query, options)
                .then(data => {
                if (data)
                    data.id = data._id.toHexString();
                resolve(data);
            })
                .catch(err => {
                reject(err);
            });
        });
    }
    static getMany(collectionName, queryParams) {
        return Repository._db.collection(collectionName).find(queryParams.query, queryParams.fields, queryParams.skip, queryParams.limit).toArray();
    }
    static aggregateOne(collectionName, query = [], options) {
        return new Promise((resolve, reject) => {
            var cursor = Repository._db.collection(collectionName).aggregate(query, options);
            cursor.toArray().then(data => {
                data = data || [null];
                resolve(data[0]);
            }).catch(err => {
                reject(err);
            });
        });
    }
    static aggregate(collectionName, query = [], options) {
        var cursor = Repository._db.collection(collectionName).aggregate(query, options);
        return cursor.toArray();
    }
    static insertOne(collectionName, doc, options) {
        return new Promise((resolve, reject) => {
            options = Object.assign({ setDate: true, autoGenerateName: true, preserveName: false }, options);
            if (!doc)
                reject('Invalid data');
            if (options.setDate) {
                doc['created'] = new Date();
                doc['modified'] = new Date();
            }
            if (options.createIndexes && options.createIndexes.length > 1) {
                collection.createIndexes(options.createIndexes);
            }
            var collection = Repository._db.collection(collectionName);
            if (collectionName === 'users') {
                collection.createIndex({ "email": 1 }, { unique: true });
            }
            else {
                collection.createIndex({ "name": 1 }, { unique: true });
            }
            if (!options.preserveName) {
                if (doc.name) {
                    if (!doc.display_name)
                        doc.display_name = doc.name;
                    doc.name = name_sanitizer_1.sanitizeModelName(doc.name);
                }
                else {
                    if (options.autoGenerateName)
                        doc.name = shortid.generate();
                }
            }
            try {
                var validDoc = Object.assign(new base_model_1.BaseModel(), doc);
                validDoc._id = new mongodb_1.ObjectID();
                validDoc.id = validDoc.id = validDoc._id.toHexString();
                collection.insertOne(validDoc).then(result => {
                    collection.findOne({ _id: result.insertedId }).then((inserted) => {
                        resolve(inserted);
                    }).catch((err) => {
                        resolve({ _id: result.insertedId });
                    });
                })
                    .catch(err => {
                    var defaultMessage = 'Invalid model';
                    var message = err.message.indexOf('name_1 dup key') !== -1 ? 'Name must be unique' : defaultMessage;
                    var message = err.message.indexOf('email_1 dup key') !== -1 ? 'Email must be unique' : defaultMessage;
                    ;
                    reject(message);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    static createIndexes(collectionName, indexes) {
        return Repository._db.collection(collectionName).createIndexes(indexes);
    }
    static insertMany(collectionName, docs) {
        return Repository._db.collection(collectionName).insertMany(docs);
    }
    static updateOne(collectionName, filter, doc, options = {}, setDate = true, createIndexes) {
        var collection = Repository._db.collection(collectionName);
        if (createIndexes && createIndexes.length > 1) {
            collection.createIndexes(createIndexes);
        }
        if (setDate)
            doc['last_modified'] = new Date().toISOString();
        delete doc['_id'];
        var update = { $set: doc };
        const updateResult = collection.updateOne(filter, update, options);
        return collection.findOne(filter);
    }
    static updateMany(collectionName, filter, doc, options) {
        return Repository._db.collection(collectionName).updateMany(filter, doc);
    }
    static deleteOne(collectionName, filter) {
        return Repository._db.collection(collectionName).deleteOne(filter);
    }
    static deleteMany(collectionName, filter) {
        return Repository._db.collection(collectionName).deleteMany(filter);
    }
    static exists(collectionName, filter) {
        return new Promise((resolve, reject) => {
            Repository._db.collection(collectionName).count(filter)
                .then((count) => resolve(count > 0))
                .catch((error) => reject(error));
        });
    }
    static getFileData(query, tempFilePath, bucketName) {
        bucketName = bucketName || Repository._bucketName;
        return new Promise((resolve, reject) => {
            Repository.getOneFileInfo(query, bucketName).then((info) => {
                if (!info)
                    return reject('File not found');
                let tempFileName = path.join(tempFilePath, info.filename);
                let dir = path.dirname(tempFileName);
                try {
                    let fileStat = fs.statSync(tempFileName);
                    if (fileStat && fileStat.mtime.getTime() > info.uploadDate.getTime()) {
                        console.log('Using cached version');
                        return resolve(path.resolve(tempFileName));
                    }
                }
                catch (err) { }
                try {
                    Repository.mkdirRecursive(dir);
                }
                catch (err) {
                    console.log('Unable to create dir', dir, err);
                }
                console.log('Opening stream');
                Repository.getBucket(bucketName).openDownloadStreamByName(info.filename)
                    .pipe(fs.createWriteStream(tempFileName)).
                    on('error', (error) => {
                    console.log('Stream error', error);
                    reject(error);
                }).
                    on('finish', () => {
                    console.log('Stream finished');
                    resolve(path.resolve(tempFileName));
                });
            }).catch(err => {
                console.log('Unable to get info', err);
                reject(err);
            });
        });
    }
    static getOneFileInfo(query, bucketName) {
        bucketName = bucketName || Repository._bucketName;
        return Repository.getOne(`${bucketName}.files`, query);
    }
    static getManyFileInfo(query, bucketName) {
        bucketName = bucketName || Repository._bucketName;
        return Repository.getMany(`${bucketName}.files`, query);
    }
    static createFileFromPath(path, folderAndFilename, extraData, bucketName) {
        bucketName = bucketName || Repository._bucketName;
        return new Promise((resolve, reject) => {
            let query = { filename: folderAndFilename };
            try {
                if (!folderAndFilename)
                    throw new Error('Output file name must be specified');
                if (!path)
                    throw new Error('File name was null');
                folderAndFilename = folderAndFilename.split('?')[0];
                Repository.beginUploadProcess(path, folderAndFilename, bucketName).then((fileInfo) => {
                    if (fileInfo && extraData) {
                        let id = fileInfo._id.toHexString();
                        Repository.updateFileMetaData(id, extraData, bucketName).then((info) => {
                            return resolve(Object.assign(fileInfo, info));
                        }).catch(err => {
                            return resolve(fileInfo);
                        });
                    }
                    else {
                        return resolve(fileInfo);
                    }
                }).catch(err => {
                    return reject(err);
                });
            }
            catch (error) {
                return reject(error);
            }
        });
    }
    static updateFileMetaData(folderAndFilename_or_id, data, bucketName) {
        bucketName = bucketName || Repository._bucketName;
        return new Promise((resolve, reject) => {
            let file_id = folderAndFilename_or_id;
            let query = { filename: file_id };
            try {
                query = { _id: mongodb_1.ObjectID.createFromHexString(file_id) };
            }
            catch (error) { }
            try {
                console.log('Metadata', data, query, bucketName);
                Repository.updateOne(`${bucketName}.files`, query, data).then((updated) => {
                    Repository.getOneFileInfo(query, bucketName).then(fileInfo => {
                        resolve(fileInfo);
                    }).catch(err => {
                        reject(err);
                    });
                }).catch(err => {
                    reject(err);
                });
            }
            catch (error) {
                return reject(error);
            }
        });
    }
    static renameFile(id, newFilename, bucketName) {
        bucketName = bucketName || Repository._bucketName;
        return new Promise((resolve, reject) => {
            try {
                if (!newFilename)
                    return new Error('New file name not specifed');
                let file_id = id;
                let query = { _id: file_id };
                try {
                    query = { _id: mongodb_1.ObjectID.createFromHexString(file_id) };
                }
                catch (error) { }
                newFilename = newFilename.split('?')[0];
                Repository.getBucket(bucketName).rename(query._id, newFilename, (err) => {
                    if (err) {
                        console.log('Unable to rename file with id', id);
                        return reject(err);
                    }
                    Repository.getOneFileInfo(query, bucketName).then(fileInfo => {
                        resolve(fileInfo);
                    }).catch(err => {
                        console.log('Unable to get detail after renaming file with id', query._id);
                        reject(err);
                    });
                });
            }
            catch (error) {
                console.log('Unknown error while renaming file with id', id);
                return reject(error);
            }
        });
    }
    static deleteFile(id, bucketName) {
        bucketName = bucketName || Repository._bucketName;
        return new Promise((resolve, reject) => {
            let file_id = id;
            let query = { _id: file_id };
            try {
                query = { _id: mongodb_1.ObjectID.createFromHexString(file_id) };
            }
            catch (error) { }
            try {
                Repository.getBucket(bucketName).delete(query._id, (err) => {
                    if (err) {
                        console.log('Unable to delete file with id', query._id);
                        return reject(err);
                    }
                    resolve({ deleted: true });
                });
            }
            catch (error) {
                console.log('Unknown error while deleting file with id', query._id);
                return reject(error);
            }
        });
    }
    static beginUploadProcess(path, folderAndFilename, bucketName) {
        bucketName = bucketName || Repository._bucketName;
        return new Promise((resolve, reject) => {
            let bucket = Repository.getBucket(bucketName);
            let bucketStream = bucket.openUploadStream(folderAndFilename);
            fs.createReadStream(path).
                pipe(bucketStream).
                on('error', (error) => {
                reject(error);
            }).
                on('finish', () => {
                console.log(`${folderAndFilename} upload complete.`);
                Repository.getOneFileInfo({ filename: folderAndFilename }, bucketName)
                    .then((file) => {
                    console.log(`Found uploaded info.`);
                    return resolve(file);
                }).catch(err => {
                    console.log(`Unable to get uploaded info.`);
                    return reject(err);
                });
            });
        });
    }
    static mkdirRecursive(targetDir) {
        const sep = path.sep;
        const initDir = path.isAbsolute(targetDir) ? sep : '';
        targetDir.split(sep).reduce((parentDir, childDir) => {
            const curDir = path.resolve(parentDir, childDir);
            if (!fs.existsSync(curDir)) {
                fs.mkdirSync(curDir);
            }
            return curDir;
        }, initDir);
    }
    static validateObjectId(id) {
        var object_id = null;
        try {
            object_id = new mongodb_1.ObjectID(id);
        }
        catch (e) {
            console.log('Unable to parse object id', e.message);
            throw new Error('Invalid id');
        }
        return object_id;
    }
    static parseFields(fields) {
        var fieldsObject = {};
        if (fields) {
            var fieldsArray = fields.split(',');
            fieldsArray.forEach((f) => {
                fieldsObject[f] = true;
            });
        }
        return fieldsObject;
    }
}
exports.Repository = Repository;
//# sourceMappingURL=Repository.js.map