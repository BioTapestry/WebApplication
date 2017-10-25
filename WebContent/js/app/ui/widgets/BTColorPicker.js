/*
**    Copyright (C) 2003-2016 Institute for Systems Biology 
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
    "dojo/_base/declare"
    ,"dijit/layout/BorderContainer"
    ,"dijit/layout/ContentPane"
    ,"dijit/form/ValidationTextBox"
    ,"dojo/dom-construct"
    ,"dojo/dom-style"
    ,"dojo/on"
    ,"dojo/_base/array"
    ,"dojo/dom-style" 
],function(
	declare
	,BorderContainer
	,ContentPane
	,ValTextBox
	,domConstruct
	,domStyle
	,on
	,DojoArray
	,domStyle
){
	
	///////////////////
	// BTColorPicker
	///////////////////
	//
	// Uses FlexiColorPicker for visualization and slider/click choosing; FlexiColorPicker
	// is instantiated as a singleton so only one color picker can be displayed at a time.
	// 
	// Provides a visualization swatch and HSV, RGB, and Hex input boxes for adjusting colors
	// via alphanumeric input values. 
	
	return declare([BorderContainer],{
				
		_disablingOverlay: null,
		
		_cpIndCont: null,
		
		_colorPicker: null,
		
		_indicators: null,
		
		_swatch: null,
		
		disabled: null,
		_setDisabledAttr: function(val) {
			if(this._disablingOverlay) {
				domStyle.set(this._disablingOverlay,"display",(val ? "block" : "none"));
			}
		},
		
		destroyRecursive: function() {
			domConstruct.destroy(this._disablingOverlay);
			
			this._indicators = null;
			domConstruct.destroy(this._swatch);
			this._swatch = null;
			
			domConstruct.destroy(this._colorPicker.pickerElement);
			this._colorPicker.pickerElement = null;
			domConstruct.destroy(this._colorPicker.sliderElement);
			this._colorPicker.sliderElement = null;

			this.inherited(arguments);
		},
	
		postCreate: function() {

			var self=this;
			
			var cpContainer = new ContentPane({
				id: "btCpContainer",
				"class": "cp-container",
				region: "left"
			});
			
			this.addChild(cpContainer);
			
			var cpDomNode = domConstruct.create("div",{
				"class": "cp-default"
			},cpContainer.domNode,"first");
						
			this._colorPicker = ColorPicker(cpDomNode,function(hex,hsv,rgb){
				self._updateIndicators(hex,hsv,rgb);
			});
						
			this._buildIndicators();
			
			this._swatch = domConstruct.create("div",{
				id: "btColorPickerSwatch"
			},this._cpIndCont.domNode,"first");
			
			this.inherited(arguments);
			
			this._disablingOverlay = domConstruct.create("div",{id: "disabling_overlay_colorpicker","class": "DisablingPicker"},this.domNode,"first");
		},
		
		clear: function() {
			this._colorPicker.setHex("#ffffff");
		},
		
		setColorHex: function(color) {
			this._colorPicker.setHex(color);
		},
		
		_updateIndicators: function(hex,hsv,rgb) {
			
			this._indicators.hex.set("value",hex,false);
			this._indicators.hex.prevVal = hex;
			this._indicators.rgb.update(rgb);
			this._indicators.hsv.update(hsv);
			
			domStyle.set(this._swatch,"background-color",hex);
		},
		
		_buildIndicators: function() {
			var self=this;
			
			this._cpIndCont = new ContentPane({
				id: "btColorPickerIndicators",
				"class": "cp-indicators",
				region: "center"
			});
			
			this.addChild(this._cpIndCont);
			
			var hexWrapper = new ContentPane({
				id: "btCpInd_hex_wrapper",
				"class": "cp-indicator-wrapper"
			});
			var rgbWrapper = new ContentPane({
				id: "btCpInd_rgb_wrapper",
				"class": "cp-indicator-wrapper"
			});
			var hsvWrapper = new ContentPane({
				id: "btCpInd_hsv_wrapper",
				"class": "cp-indicator-wrapper"
			});
			
			this._cpIndCont.addChild(hexWrapper);
			this._cpIndCont.addChild(rgbWrapper);
			this._cpIndCont.addChild(hsvWrapper);
			
			this._indicators = {
				hex: new ValTextBox({
					id: "btCpInd_hex",
					"class": "cp-indicator cp-indicator-long",
					regExp: "^#[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}$",
					invalidMessage: "Please enter a valid hexidecimal color code!",
					prevVal: null,
					onChange: function(val,withoutOnChange){
						if(this.isValid() && this.prevVal !== val) {
							!withoutOnChange && self._colorPicker.setHex(self._indicators.hex.get("value"));	
							this.prevVal = val;
						} else {
							this.set("value",this.prevVal,false);
						}
					}
				}),
				rgb: {
					r: new ValTextBox({
						id: "btCpInd_rgb_r",
						"class": "cp-indicator cp-indicator-short",
						regExp: "^(1?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])$",
						invalidMessage: "Please enter a valid value from 0 to 255!",
						prevVal: null,
						onChange: function(val,withoutOnChange) {
							if(val === "") {
								this.set("value","0",false);
							}
							if(this.isValid() && this.prevVal != val) {
								!withoutOnChange && self._colorPicker.setRgb(self._indicators.rgb.getRgb());
								this.prevVal = val;
							} else {
								this.set("value",this.prevVal,false);
							}
						}
					}),
					g: new ValTextBox({
						id: "btCpInd_rgb_g",
						"class": "cp-indicator cp-indicator-short",
						regExp: "^(1?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])$",
						invalidMessage: "Please enter a valid value from 0 to 255!",
						prevVal: null,
						onChange: function(val,withoutOnChange) {
							if(val === "") {
								this.set("value","0",false);
							}
							if(this.isValid() && this.prevVal != val) {
								!withoutOnChange && self._colorPicker.setRgb(self._indicators.rgb.getRgb());
								this.prevVal = val;
							} else {
								this.set("value",this.prevVal,false);
							}
						}
					}),
					b: new ValTextBox({
						id: "btCpInd_rgb_b",
						"class": "cp-indicator cp-indicator-short",
						regExp: "^(1?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])$",
						invalidMessage: "Please enter a valid value from 0 to 255!",
						prevVal: null,
						onChange: function(val,withoutOnChange) {
							if(val === "") {
								this.set("value","0",false);
							}
							if(this.isValid() && this.prevVal != val) {
								!withoutOnChange && self._colorPicker.setRgb(self._indicators.rgb.getRgb());
								this.prevVal = val;
							} else {
								this.set("value",this.prevVal,false);
							}
						}
					}),
					update: function(rgb) {
						this.r.set("value",rgb.r,false);
						this.r.prevVal = rgb.r;
						this.g.set("value",rgb.g,false);
						this.g.prevVal = rgb.g;
						this.b.set("value",rgb.b,false);
						this.b.prevVal = rgb.b;
					},
					getRgb: function() {
						return {r: this.r.get("value"), g: this.g.get("value"), b: this.b.get("value")};
					}
				},
				hsv: {
					h: new ValTextBox({
						id: "btCpInd_hsv_h",
						"class": "cp-indicator cp-indicator-short",
						regExp: "^([01]?[0-9]?[0-9]|2[0-9][0-9]|3[0-5][0-9])(\\.[0-9])?$",
						invalidMessage: "Please enter a valid degree from 0[.0] to 359[.9]!",
						prevVal: null,
						onChange: function(val,withoutOnChange){
							if(this.isValid() && this.prevVal != val) {
								!withoutOnChange && self._colorPicker.setHsv(self._indicators.hsv.getHsv());
								this.prevVal = val;
							} else {
								this.set("value",this.prevVal,false);
							}
						}
					}),
					s: new ValTextBox({
						id: "btCpInd_hsv_s",
						"class": "cp-indicator cp-indicator-short",
						regExp: "^([0-9])(\\.[0-9])?|([1-9][0-9])(\\.[0-9])?|(100)(\\.0)?$",
						invalidMessage: "Please enter a valid percentage from 0[.0] to 100[.0]!",
						prevVal: null,
						onChange: function(val,withoutOnChange){
							if(this.isValid() && this.prevVal != val) {
								!withoutOnChange && self._colorPicker.setHsv(self._indicators.hsv.getHsv());
								this.prevVal = val;
							} else {
								this.set("value",this.prevVal,false);
							}
						}
						
					}),
					v: new ValTextBox({
						id: "btCpInd_hsv_v",
						"class": "cp-indicator cp-indicator-short",
						regExp: "^([0-9])(\\.[0-9])?|([1-9][0-9])(\\.[0-9])?|(100)(\\.0)?$",
						invalidMessage: "Please enter a valid percentage from 0 to 100.[0]!",
						prevVal: null,
						onChange: function(val,withoutOnChange){
							if(this.isValid() && this.prevVal != val) {
								!withoutOnChange && self._colorPicker.setHsv(self._indicators.hsv.getHsv());
								this.prevVal = val;
							} else {
								this.set("value",this.prevVal,false);
							}
						}
					}),
					update: function(hsv) {
						this.h.set("value", hsv.h.toFixed(1),false);
						this.h.prevVal = hsv.h.toFixed(1);
						this.s.set("value",(hsv.s * 100).toFixed(1),false);
						this.s.prevVal = hsv.s.toFixed(1);
						this.v.set("value",(hsv.v * 100).toFixed(1),false);
						this.v.prevVal = hsv.v.toFixed(1);
					},
					getHsv: function() {
						return {h: this.h.get("value"), s: this.s.get("value")/100, v: this.v.get("value")/100};
					}
				}
			};
			
			hexWrapper.addChild(this._indicators.hex);
			rgbWrapper.addChild(this._indicators.rgb.r);
			rgbWrapper.addChild(this._indicators.rgb.g);
			rgbWrapper.addChild(this._indicators.rgb.b);
			hsvWrapper.addChild(this._indicators.hsv.h);
			hsvWrapper.addChild(this._indicators.hsv.s);
			hsvWrapper.addChild(this._indicators.hsv.v);
		
			domConstruct.create("label",{"for": "btCpInd_hex", "class": "cp-indicator-label", innerHTML: "Hex:"},this._indicators.hex.domNode,"before");
			domConstruct.create("label",{"for": "btCpInd_rgb_r", "class": "cp-indicator-label", innerHTML: "R:"},this._indicators.rgb.r.domNode,"before");
			domConstruct.create("label",{"for": "btCpInd_rgb_g", "class": "cp-indicator-label", innerHTML: "G:"},this._indicators.rgb.g.domNode,"before");
			domConstruct.create("label",{"for": "btCpInd_rgb_b", "class": "cp-indicator-label", innerHTML: "B:"},this._indicators.rgb.b.domNode,"before");
			domConstruct.create("label",{"for": "btCpInd_hsv_h", "class": "cp-indicator-label", innerHTML: "H:"},this._indicators.hsv.h.domNode,"before");
			domConstruct.create("label",{"for": "btCpInd_hsv_s", "class": "cp-indicator-label", innerHTML: "S:"},this._indicators.hsv.s.domNode,"before");
			domConstruct.create("label",{"for": "btCpInd_hsv_v", "class": "cp-indicator-label", innerHTML: "V:"},this._indicators.hsv.v.domNode,"before");
		},
		
		constructor: function(params) {
			
			params.id = "btColorPicker_container";
			
			params.region = params.region || "center";
						
			params.disabled = false;
			
			this.inherited(arguments);
		}
	
	});
	
});