/*
 **    Copyright (C) 2003-2014 Institute for Systems Biology
 **                            Seattle, Washington, USA.
 **
 **    This library is free software; you can redistribute it and/or
 **    modify it under the terms of the GNU Lesser General Public
 **    License as published by the Free Software Foundation; either
 **    version 2.1 of the License, or (at your option) any later version.
 **
 **    This library is distributed in the hope that it will be useful,
 **    but WITHOUT ANY WARRANTY; without even the implied warranty of
 **    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 **    Lesser General Public License for more details.
 **
 **    You should have received a copy of the GNU Lesser General Public
 **    License along with this library; if not, write to the Free Software
 **    Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

define([

], function(

) {
    var NodeMoveContext = {
        // TODO remove
        getModel: function() {
            return this._model;
        },
        isEnabled: function() {
            return this._enabled;
        },
        isFloaterNode: function(node_id) {
            return _.has(this._floater_nodes, node_id);
        },
        isConnectedLinkage: function(node_id) {
            return _.has(this._connected_linkages, node_id);
        },
        getFloaterTranslation: function() {
            return this._translate;
        }
    };

    return {
        create: function(model, node_id_map, enabled, translate, connected_linkages) {
            var obj = Object.create(NodeMoveContext, {
                _model: {
                    value: model,
                    enumerable: true
                },
                _enabled: {
                    value: enabled,
                    enumerable: true
                },
                _floater_nodes: {
                    value: node_id_map,
                    enumerable: true
                },
                _translate: {
                    value: translate,
                    enumerable: true
                },
                _connected_linkages: {
                    value: connected_linkages,
                    enumerable: true
                }
            });

            return obj;
        }
    };

// end define
});
