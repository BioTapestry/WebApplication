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
	"dojo/_base/declare",
	"dojo/store/Memory",
	"dojo/data/ObjectStore",
	"dojo/Stateful",
	"dijit/form/FilteringSelect",
	"dojo/Evented",
	"dojo/_base/lang",
	"dijit/Destroyable",
	"dojo/on"
],function(
	declare,
	Memory,
	ObjectStore,
	Stateful,
	Select,
	Evented,
	lang,
	Destroyable,
	on
) {

	
	///////////////////////
	// BTComboBox
	//////////////////////
	//
	// A wrapper for dijit/form/FilteringSelect which is Evented, Stateful, Destroyable,
	// and read-only, and has the ability to dynamically load values and emit change events
	
	return declare([Stateful,Evented,Destroyable],{
				
		selectBox_: null,
		
		changeHandler_: null,
		
		disabled: false,
		_disabledSetter: function(val) {
			var currState = this.disabled; 
			this.disabled = val;
			this.selectBox_.set("disabled",val);
			if(currState && !val) {
				this.emit("change",{bubbles: true, cancelable: true, newVal: this.selectBox_.get("item")});
			}
		},
		_disabledGetter: function() {
			return this.disabled;
		},
		
		destroyRecursive: function() {
			this.selexBox_ && this.selexBox_.destroyRecursive();
			this.destroy();
		},
		
		getComboBox: function() {
			return this.selectBox_;	
		},
		
		buildValues: function(availableValues) {
			var self=this;
			var data = new Array();
			for(var i in availableValues) {
				if(availableValues[i] instanceof Object) {
					var item = {};
					item.id = this.selectBox_.convertNumericIds ? parseInt(i) : i;					
					for(var j in availableValues[i]) {
						item[j] = availableValues[i][j];
					}
					data.push(item);
				} else  {
					data.push({id: this.selectBox_.convertNumericIds ? parseInt(i) : i, label: availableValues[i]});	
				}
			}

			var memoryStore = new Memory({
				data: data
			});

			this.selectBox_._onChangeActive = false;
			this.selectBox_.set("store",new ObjectStore({objectStore: memoryStore}));
			this.selectBox_._buildDropDown();
			// We don't want onChange to fire when initializaing, so we lie to the dijit about its
			// status in this regard
			this.selectBox_._lastValueReported = this.selectBox_.get("selValue");
			this.selectBox_.set("value",this.selectBox_.get("selValue"));
			this.selectBox_.get("dropDown").set("class","PreserveWhitespace");
			this.selectBox_._onChangeActive = true;
			
			this.selectBox_.textbox.readOnly = true;

		},
		
		formatValues: function() {

		},
				
		constructor: function(params) {
			var tempData = [{id: "temp", label: "data"}];
			var tempStore = new Memory({data: tempData});
			var self=this;

			declare.safeMixin(params,{
				parent_: self,
				store: new ObjectStore({objectStore: tempStore}),
				fetchProperties : { sort : [ { attribute : "id" } ] },
				searchAttr: "label",
				_buildDropDown: function() {
					if(this.dropDown) {
						this.dropDown.destroy();
					}
					var popupId = this.id + "_popup",
					dropDownConstructor = lang.isString(this.dropDownClass) ?
						lang.getObject(this.dropDownClass, false) : this.dropDownClass;
					this.dropDown = new dropDownConstructor({
						onChange: lang.hitch(this, this._selectOption),
						id: popupId,
						dir: this.dir,
						textDir: this.textDir
					});
				},
				postCreate: function() {
					this.inherited(arguments);
					this.textbox.readOnly = true;
				},
				filterContent: function(col,value) {
					var lastQuery = {label:this.get("value")};
					lastQuery[col] = value;
					
					var searchForLast = this.store.query(lastQuery);
					
					var found = false;
					
					searchForLast.forEach(function(result){
						found = true;
					});
					if(!found) {
						delete lastQuery.label;
						found = false;
						searchForLast = this.store.query(lastQuery);
						searchForLast.forEach(function(result){
							if(!found) {
								found = true;
								this.set("value",result.label);
							}
						},this);
						
						if(!found) {
							this.set("value","");
						}
					} 
					this.query = {};
					this.query[col] = value;
				}
			});

			self.selectBox_ = new Select(params);

			self.changeHandler_ = on.pausable(self.selectBox_,"change",function(newVal) {
				if(newVal) {
					self.emit("change",{bubbles: true, cancelable: true, newVal: this.item});
				}
			});
			self.own(self.changeHandler_);
		}
	});
});