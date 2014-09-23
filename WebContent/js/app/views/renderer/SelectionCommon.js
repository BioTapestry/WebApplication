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

], function (

) {
    var DRAW_LAYERS_FOR_SELECTION = [
        'BACKGROUND_REGIONS',
        'MODEL_NODEGROUPS'
    ];

    return {
        getSelectableNodesForModel: function(model) {
            var selectable_nodes = [];

            _.each(DRAW_LAYERS_FOR_SELECTION, function(draw_layer_key) {
                Array.prototype.push.apply(selectable_nodes, model.getDrawLayerByID(draw_layer_key).group_array);
            });

            return selectable_nodes;
        }
    };

// end define
});
