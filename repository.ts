import { MongoClient, MongoError, Db, InsertOneWriteOpResult, InsertWriteOpResult, UpdateWriteOpResult, DeleteWriteOpResultObject, FindOneOptions, ObjectID, Collection, CollectionAggregationOptions } from 'mongodb';
import { sanitizeModelName } from '../sanitizers/name.sanitizer';
import { BaseModel } from "../models/base.model";
const shortid = require('shortid');
export class Repository {
    /**
     *
     */
    // constructor(connectionUrl) {
    //     Repository.init(connectionUrl);
    // }
    private static _repo: Repository;
    private static _db: Db;
    static initialize(connectionUrl: string, force: boolean = false) {
        if (!Repository._db || force) {
            MongoClient.connect(connectionUrl, (err: MongoError, database: Db) => {
                if (err) return console.error("MongoDB Connection error:", err.message);
                Repository._db = database;
            });
        }
    }

    /**
     *
     */

    public static aggregateOne<T>(collectionName: string, query: Object[] = [], options?: CollectionAggregationOptions): Promise<T> {
        return new Promise((resolve, reject) => {
            var cursor = Repository._db.collection(collectionName).aggregate(query, options);
            cursor.toArray().then(data => {
                data = data || [null]
                resolve(data[0]);
            }).catch(err => {
                reject(err);
            });
        });
    }
    public static aggregate<T>(collectionName: string, query: Object[] = [], options?: CollectionAggregationOptions): Promise<T[]> {
        var cursor = Repository._db.collection(collectionName).aggregate(query, options);
        return cursor.toArray();
    }
    public static getOne<T>(collectionName: string, query: object = {}, fields: any = {}): Promise<T> {
        return new Promise((resolve, reject) => {
            var options: FindOneOptions = {};
            options.fields = fields;
            Repository._db.collection(collectionName).findOne(query, options)
                .then(data => {
                    //data = Object.assign(new BaseModel(), data);
                    if(data.id)data.id=data._id.toHexString();
                    resolve(data);
                })
                .catch(err => {
                    reject(err);
                });
        });
    }
    public static getMany<T>(collectionName: string, queryParams: RepoQueryParams | any): Promise<T[]> {
        return new Promise((resolve, reject) => {
            Repository._db.collection(collectionName).find(queryParams.query, queryParams.fields, queryParams.skip, queryParams.limit).toArray()
                .then(arrayData => {
                    arrayData = arrayData || [];
                    arrayData.map(data => {
                        data.id=data.id||data._id.toHexString();
                    });
                    resolve(arrayData);
                })
                .catch(err=>{
                    reject(err);
                });

        });
    }
    public static insertOne<T>(collectionName: string, doc: T | any, options?: { setDate?: boolean, preserveName?: boolean, autoGenerateName?: boolean }): Promise<any> {
        return new Promise((resolve, reject) => {
            options = Object.assign({ setDate: true, autoGenerateName: true, preserveName: false }, options);
            if (!doc) reject('Invalid data');
            if (options.setDate) {
                doc['created'] = new Date();
                doc['modified'] = new Date();
            }
            var collection: Collection = Repository._db.collection(collectionName);
            if (collectionName === 'users') {
                collection.createIndex({ "email": 1 }, { unique: true });
            } else {
                collection.createIndex({ "name": 1 }, { unique: true });
            }
            if (!options.preserveName) {
                if (doc.name) {
                    if (!doc.display_name) doc.display_name = doc.name;
                    doc.name = sanitizeModelName(doc.name);
                } else {
                    if (options.autoGenerateName) doc.name = shortid.generate();
                }
            }

            try {
                var validDoc:BaseModel = Object.assign(new BaseModel(), doc);
                validDoc._id = new ObjectID();
                validDoc.id = validDoc.id=validDoc._id.toHexString();
                collection.insertOne(validDoc).then(result => {
                    resolve(result);
                })
                    .catch(err => {
                        var defaultMessage = 'Invalid model';
                        var message = err.message.indexOf('name_1 dup key') !== -1 ? 'Name must be unique' : defaultMessage;
                        var message = err.message.indexOf('email_1 dup key') !== -1 ? 'Email must be unique' : defaultMessage;
                        ; reject(message);
                    })
            } catch (error) {
                reject(error);
            }
        });
    }
    public static insertMany<T>(collectionName: string, docs: T[]): Promise<InsertWriteOpResult> {
        return Repository._db.collection(collectionName).insertMany(docs);
    }

    public static updateOne<T>(collectionName: string, filter: {}, doc: T | any, updateOptions = {}, otherOptions?: { setDate?: boolean, preserveName?: boolean, autoGenerateName?: boolean }): Promise<UpdateWriteOpResult> {
        if (!doc) throw 'Document parameter cannot be empty for update.'
        var update: Object | any = {};
        if (doc._id) delete doc._id;
        otherOptions = Object.assign({ setDate: true, preserveName: false, autoGenerateName: true })
        update = doc;
        if (!otherOptions.preserveName) {
            if (doc.name) {
                doc.name = sanitizeModelName(doc.name);
            }
        }
        if (otherOptions.setDate) update['modified'] = new Date();
        return Repository._db.collection(collectionName).updateOne(filter, update, updateOptions);
    }
    public static updateOneSub<T>(collectionName: string, filter: {}, doc: T, options = {}, action = '$set', setDate = true): Promise<UpdateWriteOpResult> {
        var update: Object | any = {};
        update.action = doc;
        //if(setDate) update['$currentDate']= { lastModified: true };
        return Repository._db.collection(collectionName).updateOne(filter, update, options);
    }
    // public static updateOneSubDoc(collectionName: string, filter, subDoc, options={}): Promise<UpdateWriteOpResult> {
    //   var update = {
    //         $push:subDoc,
    //     }
    //     return Repository._db.collection(collectionName).updateOne(filter, update, options);
    // }
    public static updateMany<T>(collectionName: string, filter: object, doc: T, options = {}): Promise<UpdateWriteOpResult> {
        return Repository._db.collection(collectionName).updateMany(filter, doc, options);
    }

    public static deleteOne<T>(collectionName: string, filter: {}): Promise<DeleteWriteOpResultObject> {
        return Repository._db.collection(collectionName).deleteOne(filter);
    }
    public static deleteMany<T>(collectionName: string, filter: {}): Promise<DeleteWriteOpResultObject> {
        return Repository._db.collection(collectionName).deleteMany(filter);
    }
    public static exists<T>(collectionName: string, filter: {}): Promise<boolean> {
        return new Promise<boolean>((resolve: (v: boolean) => {}, reject) => {
            Repository._db.collection(collectionName).count(filter)
                .then((count) => resolve(count > 0))
                .catch((error) => reject(error));
        });
    }


    public static validateObjectId(id: string): ObjectID | any {
        var object_id: ObjectID = null;
        try {
            object_id = new ObjectID(id);
        } catch (e) {
            console.log('Unable to parse object id', e.message);
            throw new Error('Invalid id');
        }
        return object_id;
    }
    public static parseFields(fields: string): Object {
        var fieldsObject: any = {};
        if (fields) {
            var fieldsArray = fields.split(',');
            fieldsArray.forEach((f) => {
                fieldsObject[f] = true;
            });
        }
        return fieldsObject;
    }
}

export class RepoQueryParams {
    query: any = {};
    fields: any = {};
    skip: number = 0;
    limit: number = 1000;
}