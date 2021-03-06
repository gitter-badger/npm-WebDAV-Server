"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Lock = (function () {
    function Lock(lockKind, user, owner) {
        this.expirationDate = Date.now() + lockKind.timeout * 1000;
        this.lockKind = lockKind;
        this.owner = owner;
        this.uuid = Lock.generateUUID(this.expirationDate);
        this.userUid = user.constructor === String ? user : user.uid;
    }
    Lock.generateUUID = function (expirationDate) {
        var rnd1 = Math.ceil(Math.random() * 0x3FFF) + 0x8000;
        var rnd2 = Math.ceil(Math.random() * 0xFFFFFFFF);
        function pad(value, nb) {
            if (value < 0)
                value *= -1;
            var str = Math.ceil(value).toString(16);
            while (str.length < nb)
                str = '0' + str;
            return str;
        }
        var uuid = 'urn:uuid:';
        uuid += pad(expirationDate & 0xFFFFFFFF, 8);
        uuid += '-' + pad((expirationDate >> 32) & 0xFFFF, 4);
        uuid += '-' + pad(((expirationDate >> (32 + 16)) & 0x0FFF) + 0x1000, 4);
        uuid += '-' + pad((rnd1 >> 16) & 0xFF, 2);
        uuid += pad(rnd1 & 0xFF, 2);
        uuid += '-' + pad(rnd2, 12);
        return uuid;
    };
    Lock.prototype.isSame = function (lock) {
        return this.uuid === lock.uuid && this.userUid === lock.userUid && this.expirationDate === lock.expirationDate && this.lockKind.isSimilar(lock.lockKind);
    };
    Lock.prototype.expired = function () {
        return Date.now() > this.expirationDate;
    };
    Lock.prototype.refresh = function (timeout) {
        this.expirationDate += timeout ? timeout : this.lockKind.timeout;
    };
    return Lock;
}());
exports.Lock = Lock;
