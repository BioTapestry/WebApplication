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
    "dijit/Destroyable",
    "dojo/_base/array",
    "dojo/dom",
    "dijit/registry",
    "dojo/dom-construct",
    "dojo/_base/lang",
    "dojo/dom-style",
    "dojo/on",
    "dojo/Deferred",
    "controllers/ActionCollection",
    "dialogs/DialogDefinitions",
    "app/utils"
],function(
	declare,
	Destroyable,
	DojoArray,
	dom,
	registry,
	domConstruct,
	lang,
	domStyle,
	on,
	Deferred,
	ActionCollection,
	DialogDefs,
	utils
){

	
	////////////////////////////////
	// _parseUiElementActions
	/////////////////////////////////
	//
	// Parses a list of UI Element actions into a map
	
	function _parseUiElementActions(actionList) {
		var uiElemActionMap = {};
		DojoArray.forEach(actionList,function(action){
			uiElemActionMap[action] = true;
		});
		return uiElemActionMap;
	}
	
	////////////////////////////
	// _insertDialogIcon
	//////////////////////////////
	//
	// Method to place an icon to label the Dialog, eg. in a simple alert dialog
	
	function _insertDialogIcon(thisDialog,dialogType) {
		
		var iconClass = "BioTapIcon BioTapIcons724 BioTapIcons724" + utils.toTitleCase(dialogType);
		
		var dialogChildren = thisDialog.getChildren();
		if(dialogChildren[0] instanceof DialogDefs.getElement("LAYOUT_CONTAINER")) {
			var layoutChildren = dialogChildren[0].getChildren();
			switch(layoutChildren[0].get("region")) {
				case "top":
					break;
				case "left":
					break;
				case "center":
					domConstruct.place(
						domConstruct.create("div",{"class": iconClass}),
						layoutChildren[0].domNode,
						"first"
					);							
					break;							
			}
		} else {
			domConstruct.place(
				domConstruct.create("div",{"class": iconClass}),
				dialogChildren[0].domNode,
				"before"
			);
		}
	};
	
	/////////////////////////
	// _makeLabel
	////////////////////////
	//
	// Some widgets don't have a label capacity of their own; this will place a label for them onto the DOM. 
	// This should only be done **after** all child nodes have been otherwise added to the containing widget
	//
	// The label object should contain:
	// 	elementId: id attribute of the widget being labeled
	// 	content: The desired content of the label as a String; can be HTML formatted

	function _makeLabel(label) {		
		domConstruct.place(
			domConstruct.create("label",{
				innerHTML: label.content,
				"for": label.elementId,
				"class": label.labelClass
			}),
			dom.byId("widget_" + label.elementId) ? dom.byId("widget_" + label.elementId) : (dom.byId(label.elementId) ? dom.byId(label.elementId) : label.element),
			(label.labelClass.indexOf("left") >= 0 ? "before" : "after")
		);			
	};
	
	
	///////////////////////////
	// _addTextBlock
	/////////////////////////////
	//
	// Simple text blobs are not a widget of their own, so they have to be added in as DOM elements. 
	// We preferentially add them before or after an item in the same container as they are, or if 
	// such an item is not available, as the first child of their container (if they're the only 
	// element in a container then by default they'll be first).
	//
	// The message object should contain:
	// 	index: The index of this text blob in its element list
	// 	containerid: (optional) If this blob must be placed relative to a containing parent, the 
	// 		DOM id of that parent

	function _addTextBlock(message) {
		var placementIndex,placement,placementId;
		
		if(message.list.length <= 1) {
			placementId = message.containerid;
			placement = "first";
		} else {
			if(message.list[(message.index)-1]) {
				placementIndex = (message.index)-1;
				placement = "after";
			} else if(message.list[(message.index)+1]) {
				placementIndex = (message.index)+1;
				placement = "before";												
			}
			placementId = message.list[placementIndex].parameters.id;
		}
		message.widget.insertMessage(registry.byId(placementId).domNode,placement);				
	};
	
	/////////////////////
	// _blankForm
	///////////////////////
	//
	// Unless you destroy and create a form widget between uses it will maintain its contents. 
	// This helper method wipes out all of the values on a dialog's form elements. Form 
	// elements are identified by being widgets of dijit/form and having a 'name' property.

	function _blankForm(thisForm) {
		var formValues = thisForm.get("value");
		for(var i in formValues) {
			if(formValues.hasOwnProperty(i)) {
				formValues[i] = "";
			}
		}
		thisForm.set("value",formValues);			
	};	
	

	
	///////////////////////////////
	// _eventAction
	///////////////////////////////
	//
	// An event action which will take event arguments and dialog and UI element parameters
	// and act accordingly
	
	function _eventAction(e,thisEvent,btFrame,uiElementActions) {
		declare.safeMixin(e,{
			form: btFrame.form,
			selection: btFrame.gridSelected,
			// If an ID for this action is provided on the frame, use that preferentially,
			// because it implies an action can have multiple instances; otherwise, use the 
			// provided action parameter from the Event
			actionId: (btFrame.actionId ? btFrame.actionId : (thisEvent.parameters ? thisEvent.parameters.action : null))
		});
		
		if(btFrame.userInputs){
			declare.safeMixin(e,{
				userInputs: btFrame.userInputs
			});
		}
		if(btFrame.bundleMap) {
			declare.safeMixin(e,{
				bundleMap: btFrame.bundleMap
			});
		}
		
		if(thisEvent.parameters) {
			declare.safeMixin(e,thisEvent.parameters);
		}

		// Handle uiElementActions, which involve things like saving an element's state,
		// or filtering another lement
		if(uiElementActions.GET_ELEMENT_PROPS) {
			DojoArray.forEach(thisEvent.uiElementProps,function(elementProp){
				require(["dijit/registry"],function(registry){
					var thisElement = registry.byId(elementProp.elementId);
					var thisProp = thisElement.get(elementProp.propertyId);
					var thisSubProp = (elementProp.subPropertyId ? thisProp.get(elementProp.subPropertyId) : null);
					
					e.form[elementProp.storeAs] = (thisSubProp ? thisSubProp : thisProp);
					if(elementProp.bundleAs) {
						btFrame.bundleMap[elementProp.bundleAs] = elementProp.storeAs;
					}
				});
			});
		}
		
		if(uiElementActions.FILTER_ELEMENT) {
			require(["dijit/registry"],function(registry){
				if(e.newVal !== null && e.newVal !== undefined) {
					var toFilter = registry.byId(thisEvent.parameters.elementToFilter);
					toFilter.filterContent(thisEvent.parameters.filterOn,e.newVal[thisEvent.parameters.filterWith]);

				}
			});
		}
		
		// POP commands are specific to a given ObjectID, so we have to request a 
		// built method which we then execute; all other methods are general
		if(thisEvent.cmdAction.indexOf("POP_") == 0) {
			ActionCollection[thisEvent.cmdAction](thisEvent.parameters.objID)(e);
		} else {
			ActionCollection[thisEvent.cmdAction](e);	
		}		
	};
		
	//////////////////////////
	// _makeEventAction
	/////////////////////////
	//
	// Intermediate method to combine the event and its argument with 
	// any dialog and element-specific parameters
	
	function _makeEventAction(thisEvent,btFrame,uiElementActions) {
		return function(e) {
			_eventAction(e,thisEvent,btFrame,uiElementActions);
		};
	};
	
	
	/////////////////////////////////
	// _makeEventCallback
	////////////////////////////////
	//
	// Intermediate method to make a new environment for this callback, and 
	// blank the relevant form elements and close the dialog if needed
	function _makeEventCallback(eventAction,btFrame,withDialogClose,withBlankForm) {
		if(withDialogClose && btFrame.isDialog) {
			return function(e) {
				e.isWindow = btFrame.isWindow;
				e.isDialog = btFrame.isDialog;
				btFrame.hide().then(function(){
					eventAction(e);
					if(withBlankForm) {
						_blankForm(btFrame);
					}								
				});
			};
		} else {
			return function(e) {
				e.isWindow = btFrame.isWindow;
				e.isDialog = btFrame.isDialog;
				eventAction(e);
				if(withBlankForm) {
					_blankForm(btFrame);
				}									
			};
		}
	};	
	
	//////////////////////////////////
	// _buildElementList
	///////////////////////////////
	//
	// Generate the contents of an element list, which may be an abstract container 
	// (i.e. just a straight list of widgets to generate) or the page/pane of a 
	// containing element (eg. a tab control or layout container).

	function _buildElementList(btFrame,elementList,collexName,container,thisCollection,labels,textMessages) {
		var containerPane;

		if(thisCollection.elementType !== "ABSTRACT_CONTAINER") {
			var containerParams = {
				id: "content_pane_" + collexName.replace(/\s+/g,"_").replace(/[^A-Za-z0-9_]/g,"") + "_" + utils.makeId(),
				"class":"FrameDialogContainerPane"
			};		
			if(thisCollection.elementType === "LAYOUT_CONTAINER") {
				containerParams.region = collexName;
			} else if(thisCollection.elementType === "PANE") {
				containerParams.region = thisCollection.layout.layoutParameters.region;
			} else {
				containerParams.title = collexName;
			}
			containerPane = new DialogDefs.getElement("PANE")(containerParams);
			
			// If there are group parameters for this collecting pane, set them
			if(thisCollection.elementGroupParameters && thisCollection.elementGroupParameters[collexName]) {
				for(var i in thisCollection.elementGroupParameters[collexName]) {
					if(thisCollection.elementGroupParameters[collexName].hasOwnProperty(i)) {
						containerPane.set(i,thisCollection.elementGroupParameters[collexName][i]);
					}
				}
			}			
		} else {
			containerPane = container;
		}
		
		var elemIndex = 0;
		DojoArray.forEach(elementList,function(element){
			utils.stringToBool(element);
			utils.stringToBool(element.parameters);
			utils.stringToBool(element.validity);
			
			if(element.layout && thisCollection.elementType === "LAYOUT_CONTAINER") {
				element.parameters.region = element.layout.region; 
			}
		
			if(thisCollection.LocalElementParams && thisCollection.LocalElementParams[element.elementType]) {
				declare.safeMixin(element.parameters,thisCollection.LocalElementParams[element.elementType]);
			}
			
			var ElementType = DialogDefs.getElement(element.elementType);
			
			if(element.parameters.needsLabel){
				labels.push({
					content: element.parameters.label,
					elementId: element.parameters.id,
					labelClass: element.parameters.labelClass ? element.parameters.labelClass : "left",
					element: element
				});
			}
			
			if(thisCollection.GridRenderers && (element.elementType === "GRID" || element.elementType === "LISTSELECT")) {
				DojoArray.forEach(element.parameters.columns,function(col){
					if(thisCollection.GridRenderers[col.field]) {
						col.renderCell = thisCollection.GridRenderers[col.field];
					}
				});
			}
			
			if(element.elementType === "DRAWING_AREA") {
				require(["dojo/dom-attr"],function(domAttr){
					element.parameters.cnvContainerDomNodeId = element.parameters.id;
					element.parameters.cnvWrapperDomNodeId = containerPane.domNode.id;
					containerPane.set(
						"style",
						"overflow: hidden; white-space: nowrap; border: 2px solid #4b5a8a; padding: 0; margin: 0;"
					);	
					if(element.parameters["class"]) {
						containerPane.set("class",element.parameters["class"]);
					}
				});
			}
			
			if(element.parameters.bundleAs) {
				if(!btFrame.bundleMap) {
					btFrame.bundleMap = {};
				}
				btFrame.bundleMap[element.parameters.bundleAs] = element.parameters.name; 
			}
			
			var childElement = new ElementType(element.parameters);
			
			if(btFrame.destroyImmediate) {
				btFrame.forImmediateDestruction.push(childElement);
			}
						
			if(element.elementType === "SELECTION_GROUP" || element.elementType === "COMBO_BOX_TEXT") {
				childElement.buildValues(element.availableValues);
			}
			
			// Some elements rely on certain conditions to be met before they are enabled;
			// check those conditions
			if(element.validity) {
				require(["models/conditions/ElementConditions"],function(BTElementConditions){					
					container.own(
						BTElementConditions.watch(element.validity.conditionName,function(name,oldval,newval){
							if(element.elementType === "GRID" || element.elementType === "LISTSELECT") {
								childElement.disable(!(element.validity.conditionValue === newval));
							} else {
								childElement.set("disabled",!(element.validity.conditionValue === newval));
							}
						})
					);
				});					
			}
			
			// Grids are specially instantiated
			if(element.elementType === "GRID" || element.elementType === "LISTSELECT") {
				element.availableValues && childElement.renderArray(element.availableValues.list);
				childElement.own(childElement.on("dgrid-select",function(e){
					DojoArray.forEach(e.rows,function(row){
						if(!btFrame.gridSelected) {
							btFrame.gridSelected = {};
							btFrame.gridSelected.selectionMode = element.parameters.selectionMode;
						}
						btFrame.gridSelected[row.id] = row.data;
					});
				}));
				childElement.own(childElement.on("dgrid-deselect",function(e){
					DojoArray.forEach(e.rows,function(row){
						if(btFrame.gridSelected && btFrame.gridSelected[row.id]) {
							delete btFrame.gridSelected[row.id];
						}
						
					});
				}));
				if(element.parameters.selectedIndex !== null && element.parameters.selectedIndex !== undefined) {
					if(element.availableValues) {	
						childElement.own(on(btFrame,"built",function(e){
							require(["dojo/query","put-selector/put"],function(query,put) {
								var selexNode = query(".dgrid-row", childElement.domNode)[element.parameters.selectedIndex];
								childElement.select(selexNode);
							});
						}));
					} else {
						// If there are no available values but there is a selectedIndex, this selection has to happen post-build
						// in order to make sure it's not cleared out by a call to startup()
						// This has to be managed at value load time, and will require access to the frame's reference, so we
						// store that here
						childElement.topLevelContainer = btFrame;
					}
				}
			}
			
			// OK, Cancel, and Submit buttons are special in that
			// they need to refer back to the evented widget,
			// so the DialogBuilder makes their events
						
			for(var j in element.events) {
								
				if(element.events.hasOwnProperty(j)) {
					var thisEvent = element.events[j];
					var uiElementActions = _parseUiElementActions(thisEvent.uiElementActions);
					var eventAction = _makeEventAction(thisEvent,btFrame,uiElementActions);
					var eventCallback = _makeEventCallback(eventAction,btFrame,!!uiElementActions.DIALOG_CLOSE,!!uiElementActions.BLANK_FORM);
										
					childElement.own(on(childElement,j,eventCallback));
				}
			}

			
			// Some elements have special placing requirements
			
			// Text messages are pushed onto an array and handled last
			if(element.elementType === "TEXT_MESSAGE") {
				textMessages.push({
					widget: childElement,
					index: elemIndex,
					list: elementList,
					containerid: containerPane.get("id")
				});
			// Drawing areas are attached after the dialog is shown (because
			// their containing DIV must be extant at attachment time)
			} else if(element.elementType === "DRAWING_AREA") {
				childElement.own(on(btFrame,"built",function(e){
					childElement.attachArtboard();
					container.own(childElement.getMyBtCanvas());
					container.resize();		
					container.own(childElement);
				}));

			// Selection groups and checkbox groups are special constructs that have to be placed
			// manually
			} else if(element.elementType === "SELECTION_GROUP" || element.elementType === "CHECKBOX") {
				childElement.own(on(btFrame,"built",function(e){
					childElement.placeMe(containerPane.domNode,"first");
					container.resize();
				}));
			} else {
				// All other elements can be placed using addChild
				var placeThis;
				if(element.elementType.indexOf("COMBO_BOX") >= 0) {
					placeThis = childElement.getComboBox();
				} else {
					placeThis = childElement;
				}
				
				// Floating elements will fall wherever the containing pane has
				// room for them. If we need an element to be on its own separate
				// block, we place it in its own paragraph (this will force
				// other elements to the next layout block)
				//
				// However, container elements should never be paragraphed, nor should
				// any element that is a dgrid type (GRID and LISTSELECT types)
								
				if(!element["float"] 
					&& element.elementType.indexOf("_CONTAINER") < 0 && element.elementType !== "PANE" 
					&& element.elementType !== "GRID" && element.elementType !== "LISTSELECT") {
					var para = domConstruct.create("p",{"class":"FrameDialogElement"},containerPane.domNode,"last");
					placeThis.placeAt(para);
				// Collecting elements are not placed; instead, they're returned, and the calling _buildElementList function will place them
				} else if(element.elementType.indexOf("_CONTAINER") < 0) {
					containerPane.addChild(placeThis);
				} else {
					containerPane = placeThis;
				}

				element.parameters.formattedValues && childElement.formatValues();
			}
			
			// If this element is a container element (eg. a tab container), build out its children now
			if(element.collectionElements) {
				var elementLists = element.collectionElements;
				var orderedLists,selected;
				
				for(var j in elementLists) {
					if(elementLists.hasOwnProperty(j)) {
						
						element.LocalElementParams = thisCollection.LocalElementParams;
						element.GridRenderers = thisCollection.GridRenderers;
						
						var listContainer = _buildElementList(btFrame,elementLists[j],j,childElement,element,labels,textMessages);
						// If this collecting element needs a specific element selected at the outset, do that now
						if(element.selected && (element.selected === j)) {
							selected = listContainer;
						}
						
						if(element.elementGroupOrder) {
							if(!orderedLists) {
								orderedLists = {
									listSize: 0
								};
							}
							orderedLists[element.elementGroupOrder[j]] = listContainer;
							orderedLists.listSize++;
						} else {
							childElement.addChild(listContainer);
							if(listContainer.minSize) {
								listContainer.resize();
							}
						}					
					}
				}
				if(orderedLists) {
					for(var n = 0; n < orderedLists.listSize; n++) {
						childElement.addChild(orderedLists[n],n);
					}
				}
				
				if(selected) {
					childElement.selectChild(selected);
				}
			}
			elemIndex++;
		});
		return containerPane;
	};
			
	///////////////////////////////////
	// _buildFrame
	//////////////////////////////////
	//
	//
	// Build a dialog based on the contents of the definition provided in the 
	// parameters
	//
	// This process is broken over the following helper functions:
	// _buildElementList
	// _buildElement
	// _makeLabel
	// _addTextBlock
	//
	function _buildFrame(frame) {
		
		var frameParams = frame.parameters;
		
		if(frameParams.destroyImmediate) {
			frameParams.forImmediateDestruction = [];	
		}
		
		frameParams.destroyImmediates = function() {
			DojoArray.forEach(this.forImmediateDestruction,function(element){
				element.destroyRecursive();
			});
			this.forImmediateDestruction = [];
		};
		
		var btFrame = new DialogDefs.getElement(frame.elementType)(frameParams);
		
		btFrame.isDialog = false;
		btFrame.isWindow = true;
		
		btFrame.form = {};
		
		var labels = new Array();
		var textMessages = new Array();
		
		var elementLists = frame.collectionElements;

		var orderedLists,selected;
		
		for(var j in elementLists) {
			if(elementLists.hasOwnProperty(j)) {
				var listContainer = _buildElementList(btFrame,elementLists[j],j,btFrame,frame,labels,textMessages);
				// If this collecting element needs a specific element selected at the outset, do that now
				if(frame.selected && (frame.selected === j)) {
					selected = listContainer;
				}
				if(frame.elementGroupOrder) {
					if(!orderedLists) {
						orderedLists = {
							listSize: 0
						};
					}
					orderedLists[frame.elementGroupOrder[j]] = listContainer;
					orderedLists.listSize++;
				} else {
					btFrame.addChild(listContainer);
				}
			}
		}
		if(orderedLists) {
			for(var n = 0; n < orderedLists.listSize; n++) {
				btFrame.addChild(orderedLists[n],n);
			}
		}
		if(selected) {
			btFrame.selectChild(selected);	
		}	
		
		// Text blocks (i.e. text messages) and labels have to be added
		// after the primary portions of the Dialog's DOM are done,
		// so that they can be placed appropriately
		DojoArray.forEach(textMessages,function(message){
			_addTextBlock(message);
		});
				
		DojoArray.forEach(labels,function(label){
			_makeLabel(label);
		});
		
		return btFrame;
		
	};	
	
	////////////////////////////////////////////////
	// Module Interface
	////////////////////////////////////////////////
	
	return {
		
		buildFrame: function(params) {
			return _buildFrame(params);
		}		
	};
});