import { IResource, ReturnCallback, SimpleCallback, Return2Callback, ResourceType, ResourcePropertyValue } from '../IResource'
import { Readable, Writable } from 'stream'
import { FSManager, FSPath } from '../../manager/FSManager'
import { LockScope } from '../lock/LockScope'
import { Workflow } from '../../helper/Workflow'
import { LockType } from '../lock/LockType'
import { LockKind } from '../lock/LockKind'
import { LockBag } from '../lock/LockBag'
import { Errors } from '../../Errors'
import { Lock } from '../lock/Lock'
import * as mimeTypes from 'mime-types'

export abstract class StandardResource implements IResource
{
    static sizeOfSubFiles(resource : IResource, targetSource : boolean, callback : ReturnCallback<number>)
    {
        resource.getChildren((e, children) => {
            if(e)
            {
                callback(e, null);
                return;
            }

            new Workflow()
                .each(children, (child, cb) => {
                    child.size(targetSource, cb);
                })
                .error((e) => callback(e, 0))
                .done((sizes) => callback(null, sizes.reduce((o, s) => o + s, 0)))
        })
    }

    properties : object
    fsManager : FSManager
    lockBag : LockBag
    parent : IResource
    dateCreation : number
    dateLastModified : number
    
    constructor(parent : IResource, fsManager : FSManager)
    {
        this.dateCreation = Date.now();
        this.properties = {};
        this.fsManager = fsManager;
        this.lockBag = new LockBag();
        this.parent = parent;
        
        this.dateLastModified = this.dateCreation;
    }

    // ****************************** Locks ****************************** //
    getAvailableLocks(callback : ReturnCallback<LockKind[]>)
    {
        callback(null, [
            new LockKind(LockScope.Exclusive, LockType.Write),
            new LockKind(LockScope.Shared, LockType.Write)
        ])
    }
    getLocks(callback : ReturnCallback<Lock[]>)
    {
        callback(null, this.lockBag.getLocks());
    }
    setLock(lock : Lock, callback : SimpleCallback)
    {
        const locked = this.lockBag.setLock(lock);
        this.updateLastModified();
        callback(locked ? null : Errors.CannotLockResource);
    }
    removeLock(uuid : string, callback : ReturnCallback<boolean>)
    {
        this.lockBag.removeLock(uuid);
        this.updateLastModified();
        callback(null, true);
    }
    getLock(uuid : string, callback : ReturnCallback<Lock>)
    {
        callback(null, this.lockBag.getLock(uuid));
    }
    
    // ****************************** Properties ****************************** //
    setProperty(name : string, value : ResourcePropertyValue, callback : SimpleCallback)
    {
        this.properties[name] = value;
        this.updateLastModified();
        callback(null);
    }
    getProperty(name : string, callback : ReturnCallback<ResourcePropertyValue>)
    {
        const value = this.properties[name];
        if(value === undefined)
            callback(Errors.PropertyNotFound, null);
        else
            callback(null, value);
    }
    removeProperty(name : string, callback : SimpleCallback)
    {
        delete this.properties[name];
        this.updateLastModified();
        callback(null);
    }
    getProperties(callback : ReturnCallback<object>)
    {
        callback(null, this.properties);
    }
    
    // ****************************** Actions ****************************** //
    abstract create(callback : SimpleCallback)
    abstract delete(callback : SimpleCallback)
    abstract moveTo(parent : IResource, newName : string, overwrite : boolean, callback : SimpleCallback)
    abstract rename(newName : string, callback : Return2Callback<string, string>)

    // ****************************** Content ****************************** //
    abstract write(targetSource : boolean, callback : ReturnCallback<Writable>)
    abstract read(targetSource : boolean, callback : ReturnCallback<Readable>)
    abstract mimeType(targetSource : boolean, callback : ReturnCallback<string>)
    abstract size(targetSource : boolean, callback : ReturnCallback<number>)
    
    // ****************************** Std meta-data ****************************** //
    creationDate(callback : ReturnCallback<number>)
    {
        callback(null, this.dateCreation);
    }
    lastModifiedDate(callback : ReturnCallback<number>)
    {
        callback(null, this.dateLastModified);
    }
    abstract webName(callback : ReturnCallback<string>)
    abstract type(callback : ReturnCallback<ResourceType>)
    
    // ****************************** Children ****************************** //
    abstract addChild(resource : IResource, callback : SimpleCallback)
    abstract removeChild(resource : IResource, callback : SimpleCallback)
    abstract getChildren(callback : ReturnCallback<IResource[]>)

    protected updateLastModified()
    {
        this.dateLastModified = Date.now();
    }

    protected removeFromParent(callback : SimpleCallback)
    {
        StandardResource.standardRemoveFromParent(this, callback);
    }
    public static standardRemoveFromParent(resource : IResource, callback : SimpleCallback)
    {
        const parent = resource.parent;
        if(parent)
            parent.removeChild(resource, (e) => {
                if(e)
                {
                    callback(e)
                    return;
                }
                
                if(resource.parent === parent) // resource.parent didn't change
                    resource.parent = null;
                callback(null);
            });
        else
            callback(null);
    }
    public static standardMoveTo(resource : IResource, parent : IResource, newName : string, overwrite : boolean, callback : SimpleCallback)
    {
        parent.getChildren((e, children) => {
            new Workflow()
                .each(children, (child, cb) => child.webName((e, name) => {
                    if(e)
                        cb(e);
                    else if(name === newName && !overwrite)
                        cb(Errors.ResourceAlreadyExists);
                    else if(name === newName && overwrite)
                        cb(null, child);
                    else
                        cb();
                }))
                .error(callback)
                .done((conflictingChildren) => {
                    conflictingChildren = conflictingChildren.filter((c) => !!c);

                    new Workflow()
                        .each(conflictingChildren, (child : IResource, cb) => child.delete(cb))
                        .error(callback)
                        .done(() => {
                            if(parent === resource.parent)
                            {
                                resource.rename(newName, (e, oldName, newName) => {
                                    callback(e);
                                })
                                return;
                            }

                            StandardResource.standardRemoveFromParent(resource, (e) => {
                                if(e)
                                {
                                    callback(e);
                                }
                                else
                                {
                                    resource.rename(newName, (e, oldName, newName) => {
                                        if(e)
                                            callback(e);
                                        else
                                            parent.addChild(resource, (e) => {
                                                callback(e);
                                            })
                                    })
                                }
                            })
                        })
                })
        })
    }
    public static standardMimeType(resource : IResource, targetSource : boolean, callback : ReturnCallback<string>)
    {
        resource.type((e, type) => {
            if(e)
                callback(e, null);
            else if(type.isFile)
            {
                resource.webName((e, name) => {
                    if(e)
                        callback(e, null);
                    else
                    {
                        const mt = mimeTypes.contentType(name);
                        callback(null, mt ? mt as string : 'application/octet-stream');
                    }
                })
            }
            else
                callback(Errors.NoMimeTypeForAFolder, null);
        })
    }
}
