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
    "./AlphaBuilder"
], function (
    NetModuleAlphaBuilder
) {
    var OverlaySettingsPrototype = {
        isEnabled: function() {
            return this.getEnabledID() !== null;
        },

        getEnabledID: function() {
            return this["overlay_id"];
        },

        setEnabledID: function(overlay_id) {
            this.overlay_id = overlay_id;
        },

        getEnabledModules: function() {
            return this.enabled_modules;
        },

        setEnabledModules: function(enabled_modules) {
            this.enabled_modules = enabled_modules;
        },

        getAlphaSettings: function() {
            return this.alpha;
        }
    };

    return {
        create: function() {
            var obj = Object.create(OverlaySettingsPrototype);
            var alphaSettings = {};
            NetModuleAlphaBuilder.alphaCalc(100.0, alphaSettings);

            obj["overlay_id"] = null;
            obj["enabled_modules"] = [];
            obj["alpha"] = alphaSettings;
            return obj;
        },

        createWithParams: function(overlay_id, enabled_modules, alpha_settings) {
            var obj = Object.create(OverlaySettingsPrototype);
            obj["overlay_id"] = overlay_id;
            obj["enabled_modules"] = enabled_modules;
            obj["alpha"] = alpha_settings;
            return obj;
        }
    };
});
