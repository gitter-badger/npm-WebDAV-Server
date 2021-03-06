import { IResource, SimpleCallback, ReturnCallback, Return2Callback, ResourceType } from '../IResource'
import { Readable, Writable } from 'stream'
import { PhysicalFSManager } from '../../manager/PhysicalFSManager'
import { StandardResource } from '../std/StandardResource'
import { FSManager } from '../../manager/FSManager'
import * as path from 'path'
import * as fs from 'fs'

export abstract class PhysicalResource extends StandardResource
{
    realPath : string
    name : string
    
    constructor(realPath : string, parent ?: IResource, fsManager ?: FSManager)
    {
        if(!fsManager)
            if(parent && parent.fsManager && parent.fsManager.constructor === PhysicalFSManager)
                fsManager = parent.fsManager;
            else
                fsManager = new PhysicalFSManager();

        super(parent, fsManager);

        this.realPath = path.resolve(realPath);
        this.name = path.basename(this.realPath);
    }
    
    // ****************************** Actions ****************************** //
    abstract create(callback : SimpleCallback)
    abstract delete(callback : SimpleCallback)
    moveTo(parent : IResource, newName : string, overwrite : boolean, callback : SimpleCallback)
    {
        StandardResource.standardMoveTo(this, parent, newName, overwrite, callback);
    }
    rename(newName : string, callback : Return2Callback<string, string>)
    {
        const newPath = path.join(this.realPath, '..', newName);
        fs.rename(this.realPath, newPath, (e) => {
            if(e)
            {
                callback(e, null, null);
                return;
            }
            const oldName = path.basename(this.realPath);
            this.realPath = newPath;
            this.name = newName;
            this.updateLastModified();
            callback(null, oldName, newName);
        })
    }
    
    // ****************************** Std meta-data ****************************** //
    webName(callback : ReturnCallback<string>)
    {
        callback(null, path.basename(this.name));
    }
    abstract type(callback : ReturnCallback<ResourceType>)

    // ****************************** Content ****************************** //
    abstract write(targetSource : boolean, callback : ReturnCallback<Writable>)
    abstract read(targetSource : boolean, callback : ReturnCallback<Readable>)
    abstract mimeType(targetSource : boolean, callback : ReturnCallback<string>)
    abstract size(targetSource : boolean, callback : ReturnCallback<number>)
    
    // ****************************** Children ****************************** //
    abstract addChild(resource : IResource, callback : SimpleCallback)
    abstract removeChild(resource : IResource, callback : SimpleCallback)
    abstract getChildren(callback : ReturnCallback<IResource[]>)
}
