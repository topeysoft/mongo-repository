"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
const name_sanitizer_1 = require("./sanitizers/name.sanitizer");
const shortid = require('shortid');
class Repository {
    static initialize(connectionUrl, force = false) {
        if (!Repository._db || force) {
            mongodb_1.MongoClient.connect(connectionUrl, (err, database) => {
                if (err)
                    return console.error("MongoDB Connection error:", err.message);
                Repository._db = database;
            });
        }
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
    static getOne(collectionName, query = {}, fields = {}) {
        return new Promise((resolve, reject) => {
            var options = {};
            options.fields = fields;
            Repository._db.collection(collectionName).findOne(query, options)
                .then(data => {
                if (data.id)
                    data.id = data._id.toHexString();
                resolve(data);
            })
                .catch(err => {
                reject(err);
            });
        });
    }
    static getMany(collectionName, queryParams) {
        return new Promise((resolve, reject) => {
            Repository._db.collection(collectionName).find(queryParams.query, queryParams.fields, queryParams.skip, queryParams.limit).toArray()
                .then(arrayData => {
                arrayData = arrayData || [];
                arrayData.map(data => {
                    data.id = data.id || data._id.toHexString();
                });
                resolve(arrayData);
            })
                .catch(err => {
                reject(err);
            });
        });
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
                var validDoc = Object.assign({}, doc);
                validDoc._id = new mongodb_1.ObjectID();
                validDoc.id = validDoc.id = validDoc._id.toHexString();
                collection.insertOne(validDoc).then(result => {
                    resolve(result);
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
    static insertMany(collectionName, docs) {
        return Repository._db.collection(collectionName).insertMany(docs);
    }
    static updateOne(collectionName, filter, doc, updateOptions = {}, otherOptions) {
        if (!doc)
            throw 'Document parameter cannot be empty for update.';
        var update = {};
        if (doc._id)
            delete doc._id;
        otherOptions = Object.assign({ setDate: true, preserveName: false, autoGenerateName: true });
        update = doc;
        if (!otherOptions.preserveName) {
            if (doc.name) {
                doc.name = name_sanitizer_1.sanitizeModelName(doc.name);
            }
        }
        if (otherOptions.setDate)
            update['modified'] = new Date();
        return Repository._db.collection(collectionName).updateOne(filter, update, updateOptions);
    }
    static updateOneSub(collectionName, filter, doc, options = {}, action = '$set', setDate = true) {
        var update = {};
        update.action = doc;
        return Repository._db.collection(collectionName).updateOne(filter, update, options);
    }
    static updateMany(collectionName, filter, doc, options = {}) {
        return Repository._db.collection(collectionName).updateMany(filter, doc, options);
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
class RepoQueryParams {
    constructor() {
        this.query = {};
        this.fields = {};
        this.skip = 0;
        this.limit = 1000;
    }
}
exports.RepoQueryParams = RepoQueryParams;
//# sourceMappingURL=index.js.map