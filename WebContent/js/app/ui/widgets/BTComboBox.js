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
	,"dojo/dom-construct"
	,"dojo/store/Memory"
	,"dojo/data/ObjectStore"
	,"dijit/form/FilteringSelect"
	,"dojo/_base/lang"
	,"dojo/dom-class"
	,"dojo/aspect"
	,"dojo/_base/array"
	,"dojo/dom-construct"
	,"dojo/dom-style"
	,"dojo/dom"
],function(
	declare
	,domConstruct
	,Memory
	,ObjectStore
	,Select
	,lang
	,domClass
	,aspect
	,DojoArray
	,domConstruct
	,domStyle
	,dom
) {
	
	///////////////////////
	// BTComboBox
	//////////////////////
	//
	// An extenion of dijit/form/FilteringSelect which is readonly, has the ability to dynamically 
	// load values, provides a method for fetching a data object related to a given value, and will 
	// place its own label
	//
	// This ComboBox can be turned into a color chooser dropdown by providing a data
	// set which has a color field (Hex) and setting the combo box 'comboType' to COLOR_CHOOSER
	//
	return declare([Select],{
		
		uiElementType: "COMBO_BOX",
		
		comboType: "TEXT",
		
		labelNode: null,
		
		labelPlacement: null,
		
		label: null,
		
		fetchProperties : { sort : [ { attribute : "id" } ] },
		
		searchAttr: "label",
		
		changeHandler_: null,
		
		// Indicates if any function bound to onChange should fire when the widget is
		// enabled (overrides default behavior)
		changeAtEnable: false,
		
		selValue: null,
		
		// Indicates if numeric values sent as strings should be converted back to numbers
		convertNumericVals: false,
		
		// Override
		///////////////////////
		// _setDisabledAttr
		//////////////////////
		//
		// Override to trigger the onChange when this box is activated, if changeAtEnable is true
		//
		_setDisabledAttr: function(val) {
			var currState = this.disabled; 
			this.disabled = val;
			if(currState && !val && this.changeAtEnable) {
				this.onChange(this.get("value"));
			}
		},
		
		/////////////////
		// getItem
		/////////////
		//
		// Shortcut method for fetching the object which corresponds to the
		// specified value
		//
		getItem: function(val) {
			var queryItem = {};
			queryItem[this.searchAttr] = val;
			return (this.item ? this.item : this.store.query(queryItem)[0]);
		},
			
		////////////////////
		// buildValues
		///////////////////
		//
		// Method which constructs a data store for this ComboBox based on a set of provided values;
		// these values may either be objects with the necessary properties (id, name, label) or 
		// can be an array of primitive values (strings, numbers)
		//
		buildValues: function(availableValues) {
			var data = new Array();
			for(var i in availableValues) {
				if(availableValues[i] instanceof Object) {
					var item = {};
					item.id = this.convertNumericVals ? parseInt(i) : i;					
					for(var j in availableValues[i]) {
						item[j] = availableValues[i][j];
					}
					// If this is a color chooser or image combo, the label will actually be the text plus a small 
					// color swatch
					if(this.comboType === "COLOR_CHOOSER") {
						item.name = item.label;
						item.label = "<div style=\"background-color: " + item.color + ";\" class=\"BTComboColorChooserSwatch\">&nbsp;</div>" + " " + item.name;
					}
					
					// If an 'index' value is present, use it to inform the order
					// of data in the array passed to the store constructor
					if(item.index !== null && item.index !== undefined) {
						data[item.index] = item;
					} else {
						// Othewise just push items on in the order they're handled
						data.push(item);	
					}
				} else  {
					// If this is not an object, i.e. it's an array of values, create an object to push onto the
					// data array, and convert any string numerics 
					data.push({id: this.convertNumericVals ? parseInt(i) : i, label: availableValues[i]});	
				}
			}

			this.set("store",new ObjectStore({objectStore: new Memory({ data: data })}));
			this._buildDropDown();
			// We don't want onChange to fire when initializaing a new dropdown, so we lie to the dijit about its
			// status in this regard
			this._lastValueReported = (this.convertNumericVals ? parseInt(this.get("selValue")) : this.get("selValue"));
			this.set("value",this.get("selValue"));
			this.dropDown.set("class",(this.dropDown["class"] ? this.dropDown["class"] + " " : "") + "PreserveWhitespace BTComboBoxDropDown");
						
			this.textbox.readOnly = true;
		},
		
		////////////////////////
		// _buildDropDown
		////////////////////////
		//
		// Special dropdown construction method to put a new DropDown into place
		//
		_buildDropDown: function(firstSel) {
			var self=this;
			if(!firstSel) {
				firstSel = this.get("selValue");
			}
			if(this.dropDown) {
				this.dropDown.destroy();
			}
			var popupId = this.id + "_popup",
			dropDownConstructor = lang.isString(this.dropDownClass) ?
				lang.getObject(this.dropDownClass, false) : this.dropDownClass,
				comboType = this.comboType;
			this.dropDown = new dropDownConstructor({
				onChange: lang.hitch(this, this._selectOption),
				id: popupId,
				dir: this.dir,
				textDir: this.textDir,
				onOpen: function() {
					// Highlight the current selection so it's easy to spot
					// TODO: scroll it to the top?
					// The base onDeselect will remove this class automatically when the
					// dropdown closes
					this.currSelNode && domClass.add(this.currSelNode, "dijitMenuItemSelected");
				}				
			});
						
			// Note the domNode ID of the current selected node for easy display adjustment on 
			// menu open (this is a functionality of dijit/form/Select we want in our
			// FilteringSelect extension)
			aspect.after(this.dropDown,"onSelect",function(node){
				this.currSelNode = node.id;
			},true);
			
			// If this is a color chooser, update the selection_swatch after the dropdown closes
			if(this.comboType === "COLOR_CHOOSER") {
				aspect.after(this.dropDown,"onClose",function(){
					domStyle.set("selection_swatch_"+self.id,"backgroundColor",this.items[dom.byId(this.currSelNode).getAttribute("item")].color);
				});
			}
			
			// We have to hard-define the first 'currSelNode' because no onSelect has fired to set it
			// To do that, we need to run through the domNodes and find the one we want, then, save that ID out
			aspect.after(this.dropDown,"createOptions",function(){
				if(!this.currSelNode) {
					var self=this;
					DojoArray.forEach(this.domNode.children,function(menuNode){
						if(menuNode.getAttribute("item") && self.items[menuNode.getAttribute("item")].id === firstSel) {
							self.currSelNode = menuNode.id;
						}
					});
				}
			});
		},
		
		// Override
		//////////////////
		// postCreate 
		//////////////////
		//
		// Override so we can ensure our textbox is always readOnly
		//
		postCreate: function() {
			this.inherited(arguments);
			this.textbox.readOnly = true;
		},
		
		//////////////////
		// _placeLabel
		//////////////////
		//
		// Method for placing a <label> under the same parentNode as the select box's domNode
		//
		_placeLabel: function() {
			
			if(this.label) {
				// If the combo box is being moved, we need to remove the old label 
				// and make a new one at the new location
				if(this.labelNode) {
					domConstruct.destroy(this.labelNode.id);
					this.labelNode = null;
				}
					
				this.labelNode = domConstruct.create(
					"label",
					{ 
						innerHTML: this.label,
						"class":"BTComboBoxLabel" + (!this.labelPlacement || this.labelPlacement === "before" ? " left" : "") + (this.justifiedLabel ? " Justified" : ""),
						"for": this.id,
						id: this.id+"_label"
					},
					this.domNode,
					(this.labelPlacement ? this.labelPlacement : "before")
				);	
			}
		},
		
		// Override
		//////////////////
		// placeAt
		/////////////////
		//
		// 		
		placeAt: function() {
			this.inherited(arguments);
			this._placeLabel();
	
			// If this is a COLOR_CHOOSER combo box, we need to put the selection
			// swatch (a DIV) on the DOM once the widget itself has been placed
			if(this.comboType === "COLOR_CHOOSER") {
				
				// If the swatch exists already, this is likely a 'move' placement,
				// in which case we destroy the existing swatch first
				if(dom.byId("selection_swatch_"+this.id)) {
					domConstruct.destroy("selection_swatch_"+this.id);
				}
				
				domConstruct.create("div",{
					id: "selection_swatch_"+this.id,
					style: "background-color: "+(this.item || this.store.query({id: this.selValue})[0]).color,
					innerHTML: "&nbsp;",
					"class": "BTComboColorChooserSwatch"
				},this.focusNode,"before");
			}			
		},
		
		//////////////////
		// filterContent
		/////////////////
		//
		// Method for filtering the values in the combo box based on a single property
		//
		filterContent: function(col,value) {
			// First, see if your current selection qualifies
			// for the filter; if it does, we leave it selected
			var lastQuery = {};
			lastQuery[this.searchAttr || "label"] = this.get("value");
			lastQuery[col] = value;
			
			var searchForLast = this.store.query(lastQuery);
			
			var found = false;
			
			searchForLast.forEach(function(result){
				found = true;
			});
			
			// If not, redo the query, but now remove the current selection's searchAttr
			// as a criteria
			if(!found) {
				delete lastQuery[this.searchAttr || "label"];
				found = false;
				searchForLast = this.store.query(lastQuery);
				searchForLast.forEach(function(result){
					if(!found) {
						found = true;
						this.set("value",result[this.searchAttr || "label"]);
					}
				},this);
				
				if(!found) {
					this.set("value","");
				}
			} 
			
			// Save out what we queried on to get this
			this.query = {};
			this.query[col] = value;
		},
				
		// Override
		////////////////////
		// constructor
		///////////////////
		//
		// This constructor will provide a temporary stub data set to allow construction of the widget to proceed
		//
		constructor: function(params) {
			// FilteringSelect doesn't support delayed load, so there must be a data store
			// available at construction time. If one was not passed in, put in a stub
			// store for now
			if(!params.store) {
				var tempData = [{id: "temp", label: "data"}];
				var tempStore = new Memory({data: tempData});
	
				params.store = new ObjectStore({objectStore: tempStore});
			}
			
			// COLOR_CHOOSER combo boxes have different behaviors from text combos; specifically, the searchAttr 
			// is now the name, not the label, and the label is an HTML formatted DIV to display a swatch 
			// along-side the 'label' of the color
			if(params.comboType === "COLOR_CHOOSER") {
				params["class"] = (params["class"] ? params["class"] + " " : "")  + "BTColorComboBox";
				params.labelType = "html";
				params.labelAttr = "label";
				params.searchAttr = "name";
			} else {
				params["class"] = (params["class"] ? params["class"] + " " : "")  + "BTComboBox";
			}

			// Our extended combo box provides an object with 'newVal' corresponding
			// to the item linked to the new selection, rather than a primitive value
			if(params.onChange) {
				var onChange_ = params.onChange;
				params.onChange = function(e) {
					e.newVal = this.item ? this.item : this.store.query({id: e})[0];
					onChange_(e);
				};
			}
			
			this.inherited(arguments);
		}
	});
});