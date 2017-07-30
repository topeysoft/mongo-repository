import { ObjectID } from "bson";
import * as shortid from 'shortid';
export class BaseModel {
    _id:ObjectID;
    get id():string{
        return this._id.toHexString();
    }
    set id(value){
        this._id = new ObjectID(value);
    }
    unique_name:string = shortid();
    display_name:string;
    description:string;
    created:Date
    modified:Date
}