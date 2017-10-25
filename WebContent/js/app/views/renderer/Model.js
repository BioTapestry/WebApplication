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
    "./nodes/GroupParsers"
], function (
    GroupParsers
) {
    var createDrawLayerContent = function (rc_for_font_metrics, draw_layer_groups_per_layer_id, group_parser) {
        var draw_layers = {};

        _.each(draw_layer_groups_per_layer_id, function (layer_group_array, layer_key) {
            var layer = {
                group_array: [],
                group_id_to_index_map: {}
            };

            _.each(layer_group_array, function (group_data, index) {
                var array_index = index,
                    group = group_parser.parseGroup(group_data, rc_for_font_metrics);

                layer.group_array.push(group);
                layer.group_id_to_index_map[group_data['id']] = array_index;
            });

            draw_layers[layer_key] = layer;
        });

        return draw_layers;
    };

    var createSharedItemMapping = function(model_draw_layer_content) {
        var draw_layers = [
            'MODEL_NODEGROUPS'
        ];

        var model_linkages = [];
        var shared_item_map = {};

        _.each(draw_layers, function(draw_layer_key) {
            _.chain(model_draw_layer_content[draw_layer_key].group_array)
                .filter(function(node) {
                    return node.getType() == "linkage";
                })
                .each(function(linkage_group) {
                    model_linkages.push(linkage_group);
                });
        });

        _.chain(model_linkages)
            .each(function(node) {
                _.each(node.shared, function(shared_id) {
                    if (_.has(shared_item_map, shared_id)) {
                        console.warn("ID " + node.id + " already in map");
                        shared_item_map[shared_id].push(node.id);
                    }
                    else {
                        shared_item_map[shared_id] = [node.id];
                    }
                });
            });

        return shared_item_map;
    };

    var BioTapestryModelPrototype = {
        initialize: function() {
            this._enabled_groups = {};
            this._selected_nodes_map = {};
        },
        getDrawLayerByID: function(draw_layer_key) {
            if (! _.has(this._draw_layers, draw_layer_key)) {
                throw {
                    name: 'Unknown DrawLayer Error',
                    level: 'CanvasRenderer.Model',
                    message: 'Tried to get drawlayer with unknown key \'' + draw_layer_key + '\'',
                    htmlMessage: 'Tried to drawlayer with unknown key <b>' + draw_layer_key + '</b>',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }

            return this._draw_layers[draw_layer_key];
        },
        getEnabledGroups: function() {
            return this._enabled_groups;
        },
        setEnabledGroups: function(enabled_groups_map) {
            // TODO
            // add validation of toggled_region_id_array
            this._enabled_groups = enabled_groups_map;
        },
        isEnabledGroup: function(node_id) {
            return (_.has(this._enabled_groups, node_id));
        },
        getIntersectionByID: function(node_id) {
            var intersection = null;

            if (_.has(this._selected_nodes_map, node_id)) {
                intersection = this._selected_nodes_map[node_id];
            }

            return intersection;
        },
        getOverlay: function(overlay_id) {
            if (! _.has(this._overlays, overlay_id)) {
                throw {
                    name: 'Unknown Overlay Error',
                    level: 'CanvasRenderer.Model',
                    message: 'Tried to get overlay with unknown ID \'' + overlay_id + '\'',
                    htmlMessage: 'Tried to get overlay with unknown ID <b>' + overlay_id + '</b>',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }

            return this._overlays[overlay_id];
        },
        getSelectedNodeIDMap: function() {
            return this._selected_nodes_map;
        },
        setSelectedNodeIDMap: function(param) {
            this._selected_nodes_map = param;
        },
        getSharedItem: function(shared_id) {
            var shared_item = null;
            if (_.has(this._shared_item_map, shared_id)) {
                shared_item = this._shared_item_map[shared_id];
            }

            return shared_item;
        },
        isSharedItem: function(shared_id) {
            return (_.has(this._shared_item_map, shared_id));
        },
        getType: function() {
            return "MODEL";
        }
    };


    return {
        create: function(rc_for_font_metrics, model_id, overlay_array, draw_layer_groups, model_fonts) {
            var group_parser = GroupParsers.create(model_fonts);

            var draw_layer_content = createDrawLayerContent(rc_for_font_metrics, draw_layer_groups, group_parser);
            var shared_item_mapping = createSharedItemMapping(draw_layer_content);

            var overlays = {};
            _.each(overlay_array, function(overlay_data) {
                overlays[overlay_data['id']] = group_parser._createNetOverlayGroup(overlay_data, rc_for_font_metrics);
            });

            var initialValues = {
                _id: {
                    value: model_id,
                    enumerable: true
                },

                _draw_layers: {
                    value: draw_layer_content,
                    enumerable: true
                },

                _fonts: {
                    value: model_fonts,
                    enumerable: true
                },

                _overlays: {
                    value: overlays,
                    enumerable: true
                },

                _shared_item_map: {
                    value: shared_item_mapping,
                    enumerable: true
                }
            };

            var modelInstance = Object.create(BioTapestryModelPrototype, initialValues);
            modelInstance.initialize();
            return modelInstance;
        }
    };
});
