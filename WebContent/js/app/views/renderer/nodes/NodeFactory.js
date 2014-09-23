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
    "../fonts/BioTapestryDefaultFonts",
    "./CommonNodeFunctions",
    "./ShapeFactory",
    "./PointSelection",
    "./RectangleSelection",
    "./ShapeRendererFunctions",
    "../renderer/SelectedBoundsSupport",

    "./CommonNodePrototype",
    "./node_prototypes/Linkage",
    "./node_prototypes/NetModuleLinkage",
    "./node_prototypes/NetModule"
], function (
    BioTapestryDefaultFonts,
    CommonNodeFunctions,
    ShapeFactory,
    PointSelection,
    RectangleSelection,
    ShapeRendererFunctions,
    SelectedBoundsSupport,

    CommonNodePrototype,
    LinkageNodeRendererPrototype,
    NetModuleLinkageNodeRendererPrototype,
    NetModuleRendererPrototype
 ) {
    var _buildPrototype = function(node_type, default_font) {
        var prototype = Object.create(CommonNodePrototype, {});
        _.extend(prototype, {
            _type: node_type,
            default_font: default_font
        });

        return prototype;
    };

    var geneNodeRendererPrototype = _.extend(_buildPrototype('gene', 'GENE_NAME'), {
        renderPads: function(rc) {
            _.each(this.padshapes, function (shape) {
                shape.render(rc, this);
            }, this);
        },

        getLaunchPad: function() {
            return this.pads[0];
        },

        getLandingPad: function(pad_index) {
            return this.pads[pad_index];
        }
    });

    var groupNodeRendererPrototype = _.extend(_buildPrototype('group', 'MED_LARGE'), {
        getOrder: CommonNodeFunctions._getOrder,
        getLayer: CommonNodeFunctions._getLayer,
        getIntersection: function() {
            return {
                _type: this._type,
                id: this.id,
                childid: this.childid,
                name: this.name,
                layer: this.layer,
                order: this.order,
                getChildID: CommonNodeFunctions._getChildID,
                getType: CommonNodeFunctions._getType,
                getName: CommonNodeFunctions._getName,
                getLayer: CommonNodeFunctions._getLayer,
                getOrder: CommonNodeFunctions._getOrder
            };
        },
        render: function(rendering_context) {
            if (rendering_context.getModel().isEnabledGroup(this.id)) {
                this.renderToggled(rendering_context);
            }
            else {
                this.renderNonToggled(rendering_context);
            }
        },
        renderToggled: function (rendering_context) {
            var self = this;

            _.each(this.toggled, function (shape) {
                shape.render(rendering_context, self);
            });
        },
        renderNonToggled: function (rendering_context) {
            var self = this;

            _.each(this.nontoggled, function (shape) {
                shape.render(rendering_context, self);
            });
        }
    });

    var NetOverlayRendererPrototype = _.extend(_buildPrototype('net_overlay', 'NET_MODULE'), {
        getOuterBoundsForModules: function(included_module_ids) {
            var all_module_outer_bounds = _.map(included_module_ids, function(module_id) {
                return this.module_map[module_id].getOuterBounds();
            }, this);

            return SelectedBoundsSupport.getMaximalBounds(all_module_outer_bounds);
        },
        getOverlayType: function() {
            return this.ovrtype;
        }
    });

    var _commonValues = function (node_json, node_field_names) {
        return _.reduce(node_field_names, function (values, field_name) {
            values[field_name] = {
                value: node_json[field_name],
                enumerable: true
            };

            return values;
        }, {
            base: {
                value: [],
                enumerable: true
            },
            selected: {
                value: [],
                enumerable: true
            }
        });
    };

    var _geneNodeValues = function (node_json, node_field_names) {
        return _.reduce(node_field_names, function (values, field_name) {
            values[field_name] = {
                value: node_json[field_name],
                enumerable: true
            };

            return values;
        }, {
            base: {
                value: [],
                enumerable: true
            },
            selected: {
                value: [],
                enumerable: true
            },
            padshapes: {
                value: [],
                enumerable: true
            }
        });
    };

    var _groupNodeValues = function (node_json, node_field_names) {
        return _.reduce(node_field_names, function (values, field_name) {
            values[field_name] = {
                value: node_json[field_name],
                enumerable: true
            };

            return values;
        }, {
            toggled: {
                value: [],
                enumerable: true
            },
            nontoggled: {
                value: [],
                enumerable: true
            }
        });
    };

    var _netOverlayValues = function (node_json, node_field_names) {
        return _.reduce(node_field_names, function (values, field_name) {
            values[field_name] = {
                value: node_json[field_name],
                enumerable: true
            };

            return values;
        }, {
            modules: {
                value: [],
                enumerable: true
            },
            module_map: {
                value: {},
                enumerable: true
            },
            group_rects: {
                value: [],
                enumerable: true
            },
            linkages: {
                value: [],
                enumerable: true
            }
        });
    };

    var _netModuleValues = function (node_json, node_field_names) {
        return _.reduce(node_field_names, function (values, field_name) {
            values[field_name] = {
                value: node_json[field_name],
                enumerable: true
            };

            return values;
        }, {
            edges: {
                value: [],
                enumerable: true
            },
            fills: {
                value: [],
                enumerable: true
            },
            interior_rectangles: {
                value: [],
                enumerable: true
            },
            out_rectangles: {
                value: [],
                enumerable: true
            },
            label: {
                value: [],
                enumerable: true
            },
            members: {
                value: [],
                enumerable: true
            }
        });
    };

    var ModelDataRendererPrototype = _.extend(_buildPrototype('modeldata', 'MEDIUM'), {
        getIntersection: function() {
            return null;
        },
        getIntersectionBounds: function() {
            return null;
        },
        intersectPoint: function() {
            return null;
        },
        intersectRectangle: function() {
            return null;
        }
    });

    var typemap = [
        ['bare', _commonValues, _buildPrototype('bare', 'MEDIUM'), ['id', 'name']],
        ['box', _commonValues, _buildPrototype('box', 'MEDIUM'), ['id', 'name']],
        ['gene', _geneNodeValues, geneNodeRendererPrototype, ['id', 'name', 'pads']],
        // Font depends on GroupProperties.layer
        // plain -> MED_LARGE
        // bold  -> LARGE
        ['group', _groupNodeValues, groupNodeRendererPrototype, ['id', 'order', 'layer', 'name', 'childid']],
        ['intercell', _commonValues, _buildPrototype('intercell', 'MEDIUM'), ['id', 'name']],
        ['linkage', _commonValues, LinkageNodeRendererPrototype, ['id', 'name', 'shared', 'srctag', 'trg', 'pad', 'lpad', 'linkages']],
        ['net_module_linkage', _commonValues, NetModuleLinkageNodeRendererPrototype, ['id', 'name', 'srcmodule', 'trgmodule', 'pad', 'lpad', 'linkages']],
        ['net_overlay', _netOverlayValues, NetOverlayRendererPrototype, ['id', 'name', 'ovrtype']],
        ['net_module', _netModuleValues, NetModuleRendererPrototype, ['id', 'name', 'namebounds', 'outerbounds', 'nfm', 'members']],
        //['net_module_linkage', _commonValues, _buildPrototype('bare', 'MEDIUM'), ['id', 'name']],
        ['note', _commonValues, _buildPrototype('note', 'NOTES'), ['id', 'name']],
        ['diamond', _commonValues, _buildPrototype('diamond', 'MEDIUM'), ['id', 'name']],
        ['slash', _commonValues, _buildPrototype('slash', 'MEDIUM'), ['id', 'name']],
        ['tablet', _commonValues, _buildPrototype('tablet', 'MEDIUM'), ['id', 'name']],
        ['_float', _commonValues, _buildPrototype('_float', 'MEDIUM'), ['id', 'name']],
        // Font used for rendering the modeldata TextShapes
        // are always exported (the AnnotatedFonts are flagged as overrides in GenomePresentation.renderModelData)
        ['modeldata', _commonValues, ModelDataRendererPrototype, ['id', 'name']]
    ];

    return {
        createNodeFromJSON: function (node_json) {
            var node_type = node_json.type;

            var node_spec = _.find(typemap, function (type_spec) {
                return type_spec[0] == node_type;
            });

            var node_initializer = node_spec[1],
                node_prototype,
                node_field_names;

            if (_.isFunction(node_spec[2])) {
                var parse_info = node_spec[2](node_json);
                node_prototype = parse_info.prototypeObject;
                node_field_names = parse_info.fields;
            }
            else {
                node_prototype = node_spec[2];
                node_field_names = _.isFunction(node_spec[3]) ? node_spec[3](node_json) : node_spec[3];
            }

            var initial_values = node_initializer(node_json, node_field_names);

            return Object.create(node_prototype, initial_values);
        }
    };

    // end define
});
