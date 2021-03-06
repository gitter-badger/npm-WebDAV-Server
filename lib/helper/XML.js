"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Errors_1 = require("../Errors");
var xmljs = require("xml-js");
function seekForNS(node, parentNS) {
    if (!node.attributes)
        return parentNS;
    var ns = {};
    for (var name_1 in parentNS)
        ns[name_1] = parentNS[name_1];
    for (var name_2 in node.attributes) {
        if (name_2.indexOf('xmlns:') === 0 || name_2 === 'xmlns') {
            var value = node.attributes[name_2];
            if (name_2 === 'xmlns')
                ns._default = value;
            else
                ns[name_2.substring('xmlns:'.length)] = value;
        }
    }
    return ns;
}
function mutateNodeNS(node, parentNS) {
    if (parentNS === void 0) { parentNS = { _default: 'DAV:' }; }
    if (!node)
        return;
    var nss = seekForNS(node, parentNS);
    if (node.name) {
        for (var ns in nss) {
            if (ns === '_default' && node.name.indexOf(':') === -1) {
                node.name = nss[ns] + node.name;
                break;
            }
            else if (node.name.indexOf(ns + ':') === 0) {
                node.name = nss[ns] + node.name.substring((ns + ':').length);
                break;
            }
        }
    }
    node.findIndex = function (name) {
        for (var index = 0; index < node.elements.length; ++index)
            if (node.elements[index] && node.elements[index].name && node.elements[index].name === name)
                return index;
        return -1;
    };
    node.find = function (name) {
        for (var _i = 0, _a = node.elements; _i < _a.length; _i++) {
            var element = _a[_i];
            if (element && element.name && element.name === name)
                return element;
        }
        throw Errors_1.Errors.XMLNotFound;
    };
    node.findMany = function (name) {
        var elements = [];
        for (var _i = 0, _a = node.elements; _i < _a.length; _i++) {
            var element = _a[_i];
            if (element && element.name && element.name === name)
                elements.push(element);
        }
        return elements;
    };
    if (node.elements)
        node.elements.forEach(function (n) { return mutateNodeNS(n, nss); });
    else
        node.elements = [];
}
var XML = (function () {
    function XML() {
    }
    XML.parse = function (xml) {
        try {
            return XML.parseXML(xml);
        }
        catch (_) {
            try {
                return XML.parseJSON(xml, true);
            }
            catch (_) {
                return XML.parseJSON(xml, false);
            }
        }
    };
    XML.parseJSON = function (xml, compact) {
        if (compact === void 0) { compact = true; }
        return XML.parseXML(xmljs.json2xml(xml.toString(), { compact: compact }));
    };
    XML.parseXML = function (xml) {
        var x = xmljs.xml2js(xml.constructor === String ? xml : new Buffer(xml).toString(), {
            compact: false
        });
        mutateNodeNS(x);
        return x;
    };
    XML.toJSON = function (xml) {
        if (xml === undefined || xml === null)
            return xml;
        if (xml.constructor === Number || xml.constructor === Boolean)
            return xml.toString();
        return xmljs.xml2json(xml, { compact: true, alwaysArray: true });
    };
    XML.toXML = function (xml, includeDeclaration) {
        if (includeDeclaration === void 0) { includeDeclaration = true; }
        var finalXml = xml;
        if (includeDeclaration && !xml.declaration)
            finalXml = {
                declaration: {
                    attributes: {
                        version: '1.0',
                        encoding: 'utf-8'
                    }
                },
                elements: [
                    xml
                ]
            };
        return xmljs.js2xml(finalXml, {
            compact: false
        });
    };
    XML.createElement = function (name, attributes, text) {
        if (!attributes)
            attributes = {};
        var li1 = name.lastIndexOf(':');
        var li2 = name.indexOf(':');
        var lindex = Math.max(li1 === li2 && name.indexOf('DAV:') !== 0 ? -1 : li1, name.lastIndexOf('/')) + 1;
        if (lindex !== 0) {
            var kname = 'a';
            var value = name.substring(0, lindex);
            while (attributes['xmlns:' + kname] !== undefined || value.indexOf(kname + ':') === 0) {
                var newChar = kname.charCodeAt(0) + 1;
                if (newChar > 'z'.charCodeAt(0))
                    kname = 'x' + String.fromCharCode(newChar);
                else
                    kname = kname.substr(0, kname.length - 1) + String.fromCharCode(newChar);
            }
            attributes['xmlns:' + kname] = value;
            name = kname + ':' + name.substring(lindex);
        }
        var result = {
            type: 'element',
            name: name,
            attributes: attributes,
            elements: [],
            ele: function (name, attributes, insertAtStart) {
                var el = result.eleFn(name, attributes);
                if (insertAtStart)
                    result.elements.unshift(el);
                else
                    result.elements.push(el);
                return el;
            },
            add: function (element) {
                if (element.constructor === String || element.constructor === Number || element.constructor === Boolean)
                    element = {
                        type: 'text',
                        text: element.toString()
                    };
                if (element.type === 'element') {
                    if (!element.attributes)
                        element.attributes = {};
                    var lindex_1 = element.name.lastIndexOf('/');
                    if (lindex_1 !== -1) {
                        ++lindex_1;
                        element.attributes['xmlns:x'] = element.name.substring(0, lindex_1);
                        element.name = 'x:' + element.name.substring(lindex_1);
                    }
                }
                if (element.constructor === Array)
                    element.forEach(result.add);
                else
                    result.elements.push(element);
                return element;
            },
            eleFn: XML.createElement
        };
        return result;
    };
    return XML;
}());
exports.XML = XML;
