"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bson_1 = require("bson");
class BaseModel {
    get id() {
        return this._id.toHexString();
    }
    set id(value) {
        this._id = new bson_1.ObjectID(value);
    }
}
exports.BaseModel = BaseModel;
//# sourceMappingURL=base-model.js.map