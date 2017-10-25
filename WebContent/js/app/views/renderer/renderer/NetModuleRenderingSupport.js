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

    ///////////////////////////////////
    // NetModuleRenderingSupport
    ///////////////////////////////////
    //
    // Support module for resolving which NetModule nodes of an overlay
    // belonging to a Model have to be rendered given particular OverlaySettings.
    //

    var NetModuleRenderingSupportPrototype = {

        ////////////////////////////////
        // getVisibleNetModuleNodes
        ////////////////////////////////
        //
        // Answers the NetModule nodes of the model in the configured overlay
        // that are visible (are to be rendered).
        //
        getVisibleNetModuleNodes: function() {
            return  _.filter(this.overlay.getModuleNodes(), function(module_node) {
                return _.has(this.enabled_map, module_node['id']);
            }, this);
        },

        ////////////////////////////////
        // isEnabledNetModule
        ////////////////////////////////
        //
        // Answers if the given NetModule is configured visible
        //
        isEnabledNetModule: function(module_id) {
            return _.has(this.enabled_map, module_id);
        },

        ////////////////////////////////
        // isShownNetModule
        ////////////////////////////////
        //
        // Answers if the contents of the given NetModule are to be shown
        // while rendering.
        //
        isShownNetModule: function(module_id) {
            return this.enabled_map[module_id].show == true;
        }
    };

    return {
        create: function(model, overlay_settings) {
            var obj = Object.create(NetModuleRenderingSupportPrototype, {});
            var overlay, enabled_modules;

            if (overlay_settings.isEnabled()) {
                overlay = model.getOverlay(overlay_settings.getEnabledID());
                enabled_modules = _.clone(overlay_settings.getEnabledModules());

                obj["overlay"] = overlay;
                obj["enabled_modules"] = enabled_modules;
                obj["enabled_map"] = _.indexBy(enabled_modules, 'id');
            }
            else {
                obj["overlay"] = null;
                obj["enabled_modules"] = [];
                obj["enabled_map"] = {};
            }

            return obj;
        }
    };
});
