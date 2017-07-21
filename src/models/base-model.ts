import { ObjectID } from "bson";

export class BaseModel {
    _id:ObjectID;
    get id():string{
        return this._id.toHexString();
    }
    set id(value){
        this._id = new ObjectID(value);
    }
    name:string;
    display_name:string;
    description:string;
    created:Date
    modified:Date
}