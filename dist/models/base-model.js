"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bson_1 = require("bson");
const shortid = require("shortid");
class BaseModel {
    constructor() {
        this.unique_name = shortid();
    }
    get id() {
        return this._id.toHexString();
    }
    set id(value) {
        this._id = new bson_1.ObjectID(value);
    }
}
exports.BaseModel = BaseModel;
//# sourceMappingURL=base-model.js.map