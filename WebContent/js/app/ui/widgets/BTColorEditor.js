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
    ,"dojo/dom-construct"
    ,"dojo/on"
    ,"dijit/form/Button"
    ,"dijit/form/TextBox"
    ,"dijit"
    ,"./BTColorPicker"
    ,"./BTSelectableGrid"
        
],function(
	declare
	,BorderContainer
	,ContentPane
	,domConstruct
	,on
	,Button
	,TextBox
	,dijit
	,BTColorPicker
	,SelectableGrid
){
	
	///////////////////
	// BTColorEditor
	///////////////////
	//
	// Displays a sleectable grid list of colors alongside a color picker for visualized editing
	
	return declare([BorderContainer],{
		
		_btColorPicker: null,
		
		_colorList: null,
		
		_selColor: null,
		
		_settings: null,
		
		openColor: null,
		
		isLayout: true,
		
		_buildColorList: function(colorMap) {
			
			var self=this;
			
			var colors = [];
			
			for(var i in colorMap) {
				if(colorMap.hasOwnProperty(i)) {
					if(colorMap[i].index !== undefined && colorMap[i].index !== null) {
						colors[colorMap[i].index] = colorMap[i];
					} else {
						colors.push(colorMap[i]);	
					}
				}
			}
			
			this._colorList = new SelectableGrid({
				selectionMode: "single",
				cellNavigation: false,
				"class": "ListGrid NoHeader NoGridlines AutoScroller",
				showHeader: false,
				showGridlines: false,
				columns: [{
					field: "id",
					label: "",
					renderCell: function(object,value,td,options) {
						td.innerHTML = "<div style=\"background-color: " + object.color + ";\" class=\"BTComboColorChooserSwatch\">&nbsp;</div>" + " " + object.label;
					}
				}]
			});
			
			this.own(this._colorList.on("dgrid-select",function(e){
				self._selColor.set("value",e.rows[0].data.label);
				self._btColorPicker.setColorHex(e.rows[0].data.color);
				self._btColorPicker.set("disabled",false);
			}));
			this.own(this._colorList.on("dgrid-deselect",function(e){
				self._selColor.set("value","");
				self._btColorPicker.clear();
				self._btColorPicker.set("disabled",true);
			}));			
			
			var colorListContainer = new ContentPane({
				region: "center",
				style: "width: 300px; border: 0; padding: 0;"
			});
			
			colorListContainer.addChild(this._colorList);
			
			var buttonPane = new ContentPane({
				id: "btColorEdBtns_container",
				region: "bottom",
				style: "border: none;",
				height: 40
			});
			
			buttonPane.addChild(new Button({
				label: "Add New Entry...",
				"class": "MiniButton",
				id: "btColorEd_addBtn"
			}));
			buttonPane.addChild(new Button({
				label: "Delete Entry",
				"class": "MiniButton",
				id: "btColorEd_delBtn"
			}));
			buttonPane.addChild(new Button({
				label: "Sort",
				id: "btColorEd_sortBtn",
				"class": "MiniButton"
			}));
			
			var colorListWrapper = new BorderContainer({
				region: "left",
				style: "width: 305px; border: none;"
			});
			
			colorListWrapper.addChild(colorListContainer);
			colorListWrapper.addChild(buttonPane);
			
			this.addChild(colorListWrapper);

			this._colorList.renderArray(colors);
			
		},
		
		_buildColorPicker: function(params) {
			this._btColorPicker = new BTColorPicker(params);
			
			this.addChild(this._btColorPicker);
		},
		
		setColor: function(val) {
			this._btColorPicker.setColorHex(val || this.openColor);
		},
		
		moveFocus: function() {
			dijit.byId("btColorEd_sortBtn").focus();
		},
		
		postCreate: function() {
			
			var selColorPane = new ContentPane({
				id: "cpListSelColor_container",
				region: "top",
				style: "border: none; padding: none; height: 35px;"
			});
			
			this._selColor = new TextBox({
				id: "cpListSelColor",
				style: "width: 200px; margin: -3px 0px 0px 5px;"
			});
						
			selColorPane.addChild(this._selColor);
			
			domConstruct.create("label",{id: "cpListSelColor_label","for": "cpListSelColor", "class": "cp-indicator-label", innerHTML: "Selected Color:"},this._selColor.domNode,"before");
						
			this._buildColorPicker(this._settings);
			
			this._btColorPicker.addChild(selColorPane);
			
			this._buildColorList(this._settings.colorChoices);
			
			this._btColorPicker.set("disabled",true);
			
			this.inherited(arguments);
			
		},
		
		constructor: function(params) {
			
			params.id = "btColorEditor";
			params.style = (params.style ? params.style + " " : "") + "border: 0 !important; padding: 0 !important;";
			
			this._settings = params;
			
			this.inherited(arguments);
		}
		
	});
	
});