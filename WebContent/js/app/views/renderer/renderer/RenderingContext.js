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
    var scratchCanvas = document.createElement('canvas');
    scratchCanvas.width = 10;
    scratchCanvas.height = 10;

    var RenderingContextPrototype = {
        _getGroupByID: function(group_id) {
            var draw_layer = this.getModel().getDrawLayerByID(this._draw_layer);

            if (_.has(draw_layer.group_id_to_index_map, group_id)) {
                var group_index = draw_layer.group_id_to_index_map[group_id];
                return draw_layer.group_array[group_index];
            }
            else {
                throw {
                    name: 'Unknown Group ID Error',
                    level: 'RenderingContext',
                    message: 'Tried to get group with unknown ID \'' + group_id + '\'',
                    htmlMessage: 'Tried to get group with unknown ID <b>' + group_id + '</b>',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }
        },
        getModel: function() {
            return this.model;
        },
        getCanvasContext: function() {
            return this.ctx;
        },
        getScratchCanvas: function() {
          return scratchCanvas;
        },
        getLaunchPadForTarget: function(target_id, pad_index) {
            var node = this._getGroupByID(target_id);

            if (node.getType() == "gene") {
                return node.getLandingPad(pad_index);
            }
            else {
                return null;
            }
        },
        getLandingPadForTarget: function(target_id, pad_index) {
            return this.getLaunchPadForTarget(target_id, pad_index + 1);
        },
        getNodeMoveContext: function() {
            return this._node_move_context;
        },
        getOverlayAlphaSettings: function() {
            return this._net_module_alpha_settings;
        }
    };

    return {
        create: function(model, canvas2d_context, draw_layer, node_move_context, module_alpha_settings) {
            var obj = Object.create(RenderingContextPrototype, {
                model: {
                    value: model,
                    enumerable: true
                },
                ctx: {
                    value: canvas2d_context,
                    enumerable: true
                },
                _draw_layer: {
                    value: draw_layer,
                    enumerable: true
                },
                _node_move_context: {
                    value: node_move_context,
                    enumerable: true
                },
                _net_module_alpha_settings: {
                    value: module_alpha_settings,
                    enumerable: true
                }
            });

            return obj;
        }
    };

// end define
});
