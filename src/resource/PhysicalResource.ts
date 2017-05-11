import { StandardResource, IResource, SimpleCallback, ReturnCallback, Return2Callback } from './Resource'
import { ResourceChildren, forAll } from './ResourceChildren'
import { FSManager, FSPath } from '../manager/FSManager'
import * as path from 'path'
import * as fs from 'fs'

export abstract class PhysicalResource extends StandardResource
{
    realPath : string
    
    constructor(realPath : string, parent : IResource, fsManager : FSManager)
    {
        super(parent, fsManager);

        this.realPath = path.resolve(realPath);
    }
    
    //****************************** Actions ******************************//
    abstract create(callback : SimpleCallback)
    abstract delete(callback : SimpleCallback)
    moveTo(to : FSPath, callback : Return2Callback<FSPath, FSPath>)
    {
        callback(new Error('Not implemented yet.'), null, null);
    }
    rename(newName : string, callback : Return2Callback<string, string>)
    {
        var newPath = path.join(this.realPath, '..', newName);
        fs.rename(this.realPath, newPath, e => {
            if(e)
            {
                callback(e, null, null);
                return;
            }
            var oldName = path.dirname(this.realPath);
            this.realPath = newPath;
            this.updateLastModified();
            callback(e, oldName, newName);
        })
    }
    
    //****************************** Std meta-data ******************************//
    webName(callback : ReturnCallback<string>)
    {
        callback(null, path.dirname(this.realPath));
    }

    //****************************** Content ******************************//
    abstract append(data : Int8Array, callback : SimpleCallback)
    abstract write(data : Int8Array, callback : SimpleCallback)
    abstract read(callback : ReturnCallback<Int8Array>)
    abstract mimeType(callback : ReturnCallback<string>)
    abstract size(callback : ReturnCallback<number>)
    
    //****************************** Children ******************************//
    abstract addChild(resource : IResource, callback : SimpleCallback)
    abstract removeChild(resource : IResource, callback : SimpleCallback)
    abstract getChildren(callback : ReturnCallback<Array<IResource>>)
}

export class PhysicalFolder extends PhysicalResource
{
    children : ResourceChildren

    constructor(realPath : string, parent : IResource, fsManager : FSManager)
    {
        super(realPath, parent, fsManager);

        this.children = new ResourceChildren();
    }
    
    //****************************** Actions ******************************//
    create(callback : SimpleCallback)
    {
        fs.mkdir(this.realPath, callback)
    }
    delete(callback : SimpleCallback)
    {
        this.getChildren((e, children) => {
            if(e)
            {
                callback(e);
                return;
            }

            forAll<IResource>(children, (child, cb) => {
                child.delete(cb);
            }, () => {
                fs.unlink(this.realPath, e => {
                    if(e)
                        callback(e);
                    else
                        this.removeFromParent(callback);
                });
            }, callback)
        })
    }

    //****************************** Content ******************************//
    append(data : Int8Array, callback : SimpleCallback)
    {
        callback(new Error("Invalid operation"));
    }
    write(data : Int8Array, callback : SimpleCallback)
    {
        callback(new Error("Invalid operation"));
    }
    read(callback : ReturnCallback<Int8Array>)
    {
        callback(new Error("Invalid operation"), null);
    }
    mimeType(callback : ReturnCallback<string>)
    {
        callback(null, 'directory');
    }
    size(callback : ReturnCallback<number>)
    {
        this.getChildren((e, children) => {
            if(e)
            {
                callback(e, null);
                return;
            }

            var size = 0;
            forAll<IResource>(children, (child, cb) => {
                child.size((e, s) => {
                    if(e)
                        size += s;
                    cb(null);
                })
            }, () => callback(null, size), e => callback(e, null));
        })
    }
    
    //****************************** Children ******************************//
    addChild(resource : IResource, callback : SimpleCallback)
    {
        this.children.add(resource, callback);
    }
    removeChild(resource : IResource, callback : SimpleCallback)
    {
        this.children.remove(resource, callback);
    }
    getChildren(callback : ReturnCallback<Array<IResource>>)
    {
        callback(null, this.children.children);
    }
}

import * as mimeTypes from 'mime-types'

export abstract class PhysicalFile extends PhysicalResource
{
    constructor(realPath : string, parent : IResource, fsManager : FSManager)
    {
        super(realPath, parent, fsManager);
    }
    
    //****************************** Actions ******************************//
    create(callback : SimpleCallback)
    {
        fs.open(this.realPath, fs.constants.O_CREAT, (e, fd) => {
            if(e)
                callback(e);
            else
                fs.close(fd, e => {
                    callback(e);
                });
        })
    }
    delete(callback : SimpleCallback)
    {
        fs.unlink(this.realPath, e => {
            if(e)
                callback(e);
            else
                this.removeFromParent(callback);
        })
    }

    //****************************** Content ******************************//
    append(data : Int8Array, callback : SimpleCallback)
    {
        fs.appendFile(this.realPath, data, callback);
    }
    write(data : Int8Array, callback : SimpleCallback)
    {
        fs.writeFile(this.realPath, data, callback);
    }
    read(callback : ReturnCallback<Int8Array>)
    {
        fs.readFile(this.realPath, callback);
    }
    mimeType(callback : ReturnCallback<string>)
    {
        var mt = mimeTypes.lookup(this.realPath);
        callback(mt ? null : new Error("application/octet-stream"), mt as string);
    }
    size(callback : ReturnCallback<number>)
    {
        fs.stat(this.realPath, (e, s) => callback(e, s ? s.size : null))
    }
    
    //****************************** Children ******************************//
    addChild(resource : IResource, callback : SimpleCallback)
    {
        callback(new Error("Invalid operation"));
    }
    removeChild(resource : IResource, callback : SimpleCallback)
    {
        callback(new Error("Invalid operation"));
    }
    getChildren(callback : ReturnCallback<Array<IResource>>)
    {
        callback(new Error("Invalid operation"), null);
    }
}