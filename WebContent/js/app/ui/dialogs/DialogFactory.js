/*
**    Copyright (C) 2003-2015 Institute for Systems Biology 
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
    "./BTDialog",
    "./DialogDefinitions",
    "static/TextMessages",
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
	BTDialog,
	DialogDefs,
	TextMsgs,
	utils
){

	
	/////////////////////////////////////////
	// DialogFactory
	/////////////////////////////////////////
	//
	// Dialog builder module. Given pre-defined widgets in DialogDefinitions, will build a dialog from a 
	// supplied definition, or from a pre-defined set of definitions. 
	//	
	
	
	////////////////////////////////
	// _parseUiElementActions
	/////////////////////////////////
	//
	// Parses a list of UI Element actions into a map
	//
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
	//
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
	//
	function _makeLabel(label) {
		domConstruct.place(
			domConstruct.create("label",{
				innerHTML: label.content,
				"for": label.elementId,
				"class": label.labelClass + (label.justifiedLabel ? " Justified" : "")
			}),
			dom.byId("widget_" + label.elementId) ? dom.byId("widget_" + label.elementId) : dom.byId(label.elementId),
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
	//
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
	//
	function _blankForm(thisDialog) {
		var formValues = thisDialog.get("value");
		for(var i in formValues) {
			if(formValues.hasOwnProperty(i)) {
				formValues[i] = "";
			}
		}
		thisDialog.set("value",formValues);			
	};	

	
	///////////////////////////////
	// _eventAction
	///////////////////////////////
	//
	// An event action which will take event arguments and dialog and UI element parameters
	// and act accordingly
	//
	function _eventAction(e,thisEvent,btDialog,uiElementActions,sourceElement) {
		// Combo Boxes and CheckBoxes normally return a value representing the current selection,
		// but we want our event to be an object. Convert if this is a Combo Box or Check Box 
		// event
		if(sourceElement.uiElementType === "COMBO_BOX" || sourceElement.uiElementType === "CHECK_BOX") {
			var val = e;
			e = {};
			if(sourceElement.uiElementType === "COMBO_BOX") {
				e.newVal = sourceElement.getItem(val);	
			} else {
				e.thisElement = sourceElement.value;
				e.newVal = val;
			}
		}
		declare.safeMixin(e,{
			form: btDialog.get("value"),
			selection: btDialog.gridSelected,
			// If an ID for this action is provided on the BTDialog, use that preferentially,
			// because it implies an action can have multiple instances; otherwise, use the 
			// provided action parameter from the Event
			actionId: (btDialog.actionId ? btDialog.actionId : (thisEvent.parameters ? thisEvent.parameters.action : null))
		});
		
		if(btDialog.userInputs){
			declare.safeMixin(e,{
				userInputs: btDialog.userInputs
			});
		}
		if(btDialog.bundleMap) {
			declare.safeMixin(e,{
				bundleMap: btDialog.bundleMap
			});
		}
		if(btDialog.bundleIn) {
			declare.safeMixin(e,{
				bundleIn: btDialog.bundleIn
			});
		}
		
		if(thisEvent.parameters) {
			declare.safeMixin(e,thisEvent.parameters);
			if(thisEvent.parameters.storeClick) {
				require(["dijit"],function(dijit){
					btDialog.clickValue = dijit.getEnclosingWidget(e.target).clickValue;
				});	
			}
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
						btDialog.bundleMap[elementProp.bundleAs] = elementProp.storeAs;
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
		
		if(thisEvent.cmdFunction) {
			thisEvent.cmdFunction(e);
		} else if(thisEvent.cmdAction) {
			ActionCollection[thisEvent.cmdAction](e);	
		}
	};
		
	//////////////////////////
	// _makeEventAction
	/////////////////////////
	//
	// Intermediate method to combine the event and its argument with 
	// any dialog and element-specific parameters
	//
	function _makeEventAction(thisEvent,btDialog,uiElementActions,sourceElement) {
		return function(e) {
			_eventAction(e,thisEvent,btDialog,uiElementActions,sourceElement);
		};
	};
	
	
	/////////////////////////////////
	// _makeEventCallback
	////////////////////////////////
	//
	// Intermediate method to make a new environment for this callback, and 
	// blank the relevant form elements and close the dialog if needed
	//
	function _makeEventCallback(eventAction,btDialog,withDialogClose,withBlankForm) {
		if(withDialogClose) {
			return function(e) {
				var hideComplete = btDialog.registerOnHide();
				btDialog.hide().then(function(){
					eventAction(e);
					if(withBlankForm) {
						_blankForm(btDialog);
					}
					hideComplete.resolve();
				});
			};
		} else {
			return function(e) {				
				eventAction(e);
				if(withBlankForm) {
					_blankForm(btDialog);
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
	//
	function _buildElementList(btDialog,elementList,collexName,container,thisCollection,labels,textMessages) {
		var containerPane;
		
		if(thisCollection.elementType !== "ABSTRACT_CONTAINER") {
			var containerParams = elementList.parameters;
			if(!containerParams) {
				containerParams = {
					id: "content_pane_" + collexName.replace(/\s+/g,"_").replace(/[^A-Za-z0-9_]/g,"") + "_" + utils.makeId(),
					"class":"FrameDialogContainerPane"
				};
			}
			if(thisCollection.elementType === "LAYOUT_CONTAINER") {
				containerParams.region = collexName;
			} else if(thisCollection.elementType === "PANE") {
				//containerParams.region = thisCollection.layout.layoutParameters.region;
			} else if(!containerParams.title){
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
			containerPane = btDialog;
		}
		
		var elemIndex = 0;
		
		var elementTypes = {};
		
		DojoArray.forEach(elementList,function(element){
			utils.stringToBool(element);
			utils.stringToBool(element.parameters);
			utils.stringToBool(element.validity);
			if(element.events) {
				DojoArray.forEach(Object.keys(element.events),function(ev) {
					if(element.events[ev].paramters) {
						utils.stringToBool(element.events[ev].paramters);
					}
				});
			}
											
			if(thisCollection.LocalElementParams && thisCollection.LocalElementParams[element.elementType]) {
				declare.safeMixin(element.parameters,thisCollection.LocalElementParams[element.elementType]);
			}
			
			if(element.parameters.needsLabel){
				labels.push({
					content: element.parameters.label,
					elementId: element.parameters.id,
					labelClass: element.parameters.labelClass ? element.parameters.labelClass : "left",
					justifiedLabel: element.parameters.justifiedLabel
				});
			}
						
			if((element.elementType === "GRID" || element.elementType === "LISTSELECT") 
				&& (thisCollection.GridRenderers || element.parameters.GridRenderers)) { 
				var gridRenderers = thisCollection.GridRenderers || DialogDefs.getGridRenderers(element.parameters.GridRenderers);
				DojoArray.forEach(element.parameters.columns,function(col){
					if(gridRenderers[col.field]) {
						col.renderCell = gridRenderers[col.field];
					}
				});
			}			
			
			if(element.layout && thisCollection.elementType === "LAYOUT_CONTAINER") {
				element.parameters.region = element.layout.region || element.layout.layoutParameters.region || "center"; 
			}
			
			var ElementType = DialogDefs.getElement(element.elementType);
			
			elementTypes[element.elementType] = 1;
			
			if(element.elementType === "DRAWING_AREA") {
				require(["dojo/dom-attr"],function(domAttr){
					element.parameters.cnvContainerDomNodeId = element.parameters.id;
					element.parameters.cnvWrapperDomNodeId = containerPane.domNode.id;
					// All Artboards require a tabId, because when they are asking
					// for a model they must indicate the tab that model is
					// from, or tab index 0 (first tab) will be assumed, and an
					// error will result if the model ID is not valid for that tab
					element.parameters.tabId = btDialog.tabId;
					containerPane.set("class","DrawingAreaContainer");							
				});
			}
			
			if(element.parameters.bundleAs) {
				if(!btDialog.bundleMap) {
					btDialog.bundleMap = {};
				}
				if(element.parameters.bundleIn !== null && element.parameters.bundleIn !== undefined) {
					if(!btDialog.bundleIn) {
						btDialog.bundleIn = {};
					}
					btDialog.bundleIn[element.parameters.bundleAs] = element.parameters.bundleIn;

				}
				btDialog.bundleMap[element.parameters.bundleAs] = element.parameters.name;
			}
			
			if(element.availableValues) {
				element.parameters.availableValues = element.availableValues;
			}
			
			var childElement = new ElementType(element.parameters);
			
			if(btDialog.destroyImmediate) {
				btDialog.forImmediateDestruction.push(childElement);
			}
						
			if(element.elementType === "COMBO_BOX_TEXT" || element.elementType === "COMBO_BOX_COLOR") {
				btDialog.forImmediateDestruction.push(childElement);
				childElement.buildValues(element.availableValues,element.parameters.valueOrder);
			}
			
			// Some elements rely on certain conditions to be met before they are enabled;
			// check those conditions
			if(element.validity) {
				require(["models/conditions/ElementConditions"],function(BTElementConditions){
					childElement.own(
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
						if(!btDialog.gridSelected) {
							btDialog.gridSelected = {};
							btDialog.gridSelected.selectionMode = element.parameters.selectionMode;
						}
						btDialog.gridSelected[row.id] = row.data;
					});
				}));
				childElement.own(childElement.on("dgrid-deselect",function(e){
					DojoArray.forEach(e.rows,function(row){
						if(btDialog.gridSelected && btDialog.gridSelected[row.id]) {
							delete btDialog.gridSelected[row.id];
						}
					});
				}));
				if(element.parameters.selectedIndex !== null && element.parameters.selectedIndex !== undefined) {
					if(element.availableValues) {
						childElement.own(on(btDialog,"built",function(e){
							require(["dojo/query","put-selector/put"],function(query,put) {
								var selexNode = query(".dgrid-row", childElement.domNode)[element.parameters.selectedIndex];
								childElement.select(selexNode);
							});
						}));
					} else {
						// If there are no available values but there is a selectedIndex, this selection has to happen post-build
						// in order to make sure it's not cleared out by a call to startup()
						// This has to be managed at value load time, and will require access to the dialog's reference, so we
						// store that here
						childElement.topLevelContainer = btDialog;
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
					var eventAction = _makeEventAction(thisEvent,btDialog,uiElementActions,childElement);
					var eventCallback = _makeEventCallback(eventAction,btDialog,!!uiElementActions.DIALOG_CLOSE,!!uiElementActions.BLANK_FORM);
										
					childElement.own(on(childElement,j,eventCallback));
				}
			}
			
			// If this is a ColorPicker element, it's opening value cannot be set until
			// after the dialog is opened (the various DOM nodes must exist).
			if(element.elementType === "COLOR_EDITOR") {
				btDialog.registerOnShow(function() {
					childElement.setColor();
					childElement.moveFocus();
				},true);
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
				var loadDrawingArea = function() {
					childElement.attachArtboard();
					btDialog.own(childElement);
					btDialog.resize();
				};
				if(btDialog.open) {
					on.once(btDialog,"started",loadDrawingArea);
				} else {
					btDialog.registerOnShow(loadDrawingArea,true);
				}
			// Selection groups and checkbox groups are special constructs that have to be placed
			// manually
			} else {
				// All other elements can be placed using addChild
				var placeThis = childElement;
								
				if(!element["float"] 
					&& element.elementType.indexOf("_CONTAINER") < 0 && element.elementType !== "PANE" 
					&& element.elementType !== "GRID" && element.elementType !== "LISTSELECT" && !childElement.isLayout) {
					
					// If we need an element to be on its own separate block (float===false) we place it in its own 
					// paragraph (this will force other elements to the next layout block)
					//
					// However, container elements should never be paragraphed, nor should any element that is a
					// dgrid type (GRID and LISTSELECT types)
					
					placeThis.placeAt(domConstruct.create("p",{id: "contPara_"+placeThis.id, "class":"FrameDialogElement"},containerPane.domNode,"last"));
				} else if(element.elementType.indexOf("_CONTAINER") < 0 || (thisCollection.elementType === "TAB_CONTAINER")) {
					
					// If our element isn't a container type, or, if it is but is going into a tab container, it needs to be placed
					// into a container pane (because Tab Containers get information from the content pane about their panels).
					//
					// We call placeAt, a _WidgetBase method, instead of addChild because extended child element types may
					// have overridden methods which need to be triggered.
					placeThis.set("class",((placeThis.get("class") ? placeThis.get("class") + " " : "") + "FloatingElement"));
					
					placeThis.placeAt(containerPane);
				} else {
					containerPane = placeThis;
				}
				
				// If this is an element with value options which require formatting, do that now
				element.parameters.formattedValues && childElement.formatValues && childElement.formatValues();
			}
			
			// If this element is a container element (eg. a tab container), build out its children now
			if(element.collectionElements) {
				var elementLists = element.collectionElements;
				var orderedLists,selected;
				
				for(var j in elementLists) {
					if(elementLists.hasOwnProperty(j)) {
						
						element.LocalElementParams = thisCollection.LocalElementParams;
						element.GridRenderers = thisCollection.GridRenderers;
						
						var listContainer = _buildElementList(btDialog,elementLists[j],j,childElement,element,labels,textMessages);
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
		
		// Weird problem where some button-only containers are overflowing despite not actually being too large.
		// Suspect this is related to the upper container holding a dgrid. Detect button-only containers and set 
		// them to overflow: hidden (button-containers should never have scrollbars!)
		if(Object.keys(elementTypes).length === 1 && elementTypes["BUTTON"]) {
			domStyle.set(containerPane.domNode,"overflow","hidden");
		}
		
		return containerPane;
	};
	
	//////////////////////////////
	// _buildCollection
	//////////////////////////////
	//
	// Generate the contents of an element collection
	//
	function _buildCollection(btDialog,thisCollection,labels,textMessages) {
		var container;
		
		if(thisCollection.elementType === "ABSTRACT_CONTAINER") {
			// Abstract containers don't get instantiated, and all
			// layout information of their children is ignored.
			container = btDialog;
		} else {
			utils.stringToBool(thisCollection.parameters);
			var ContainerElementType = DialogDefs.getElement(thisCollection.elementType);
			container = new ContainerElementType(thisCollection.parameters);
			btDialog.addChild(container);
		}
		
		var elementLists = thisCollection.collectionElements;
		var orderedLists,selected;
		
		for(var j in elementLists) {
			if(elementLists.hasOwnProperty(j)) {
				var listContainer = _buildElementList(btDialog,elementLists[j],j,container,thisCollection,labels,textMessages);
				// If this collecting element needs a specific element selected at the outset, do that now
				if(thisCollection.selected && (thisCollection.selected === j)) {
					selected = listContainer;
				}
				if(thisCollection.elementGroupOrder) {
					if(!orderedLists) {
						orderedLists = {
							listSize: 0
						};
					}
					orderedLists[thisCollection.elementGroupOrder[j]] = listContainer;
					orderedLists.listSize++;
				} else {
					container.addChild(listContainer);
				}
			}
		}
		if(orderedLists) {
			for(var n = 0; n < orderedLists.listSize; n++) {
				container.addChild(orderedLists[n],n);
			}
		}
		if(selected) {
			container.selectChild(selected);	
		}
	};
		
	///////////////////////////////
	// _buildDialogContents
	//////////////////////////////
	//
	// Top-level wrapper method which iterates through a set of top-level collections to produce a dialog,
	// then performs any wrap-up
	//
	function _buildDialogContents(params) {
		var btDialog = params.dialog;
		var dialogDef = params.dialogDef;
		
		var labels = new Array();
		var textMessages = new Array();
		
		var elementCollex = dialogDef.dialogElementCollections;
		
		for(var i in elementCollex) {
			if(elementCollex.hasOwnProperty(i)) {
				_buildCollection(btDialog,elementCollex[i],labels,textMessages);
			}
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
		
		// Non-'PLAIN' dialogs often have an icon associated with them
		if(dialogDef.dialogType && dialogDef.dialogType !== "PLAIN") {
			_insertDialogIcon(btDialog,dialogDef.dialogType);
		}
		
		// Finalize the Dialog
		btDialog.startup();
		
		if(btDialog.open) {
			btDialog.emit("started",{bubbles: true, cancelable: true});
		}

		// If any elements are turned on or off via element-specific stating events,
		// we will need to register them with the ElementConditions model for watching
		if(dialogDef.defaultConditionStates) {
			require(["models/conditions/ElementConditions"],function(BTElemConditions){
				DojoArray.forEach(dialogDef.defaultConditionStates,function(state){
					utils.stringToBool(state);
					BTElemConditions.set(state.conditionName,state.conditionValue);
				});
			});
		}
		
		return btDialog;
	};
	
	//////////////////////////////////////
	// _buildDialog
	//////////////////////////////////////
	//
	// Kick off a dialog build based on the provided parameters.
	//
	// This process is broken over the following helper functions:
	//
	// _buildCollection
	// _buildElementList
	// _buildElement
	// _makeLabel
	// _addTextBlock
	//
	function _buildDialog(params) {
		
		var dialogDef = params.definition;
		var dialogParams = params.definition.parameters;

		if(!dialogParams.isModal) {
			dialogParams["class"]="nonModal";
		}
		
		dialogParams.tabId = params.tabId;
		
		declare.safeMixin(dialogParams,{
			title: dialogDef.title || dialogParams.title,
			height: dialogDef.height,
			width: dialogDef.width,
			actionId: params.actionId,
			definition: dialogDef,
			openOffset: dialogDef.openOffset,
			offset: params.offset,
			userInputs: dialogDef.userInputs,
			forImmediateDestruction: []
		});
		
		if(dialogDef.cancel) {
			declare.safeMixin(dialogParams,{
				onCancel: function(e){
					if(dialogDef.cancelParameters) {
						declare.safeMixin(e,this.definition.cancelParameters);
					}
					declare.safeMixin(e,{actionId: this.actionId});
					ActionCollection[this.definition.cancel](e);
					_blankForm(this);							
				}
			});
		}
				
		var btDialog = new BTDialog(dialogParams);
		
		if(dialogParams.isEmpty) {
			return btDialog;
		}
							
		return _buildDialogContents({dialog: btDialog,dialogDef: dialogDef});

	};	
	
////////////////////////////////////////////////
// Module Interface
////////////////////////////////////////////////
	
	return {
		
		// Allows a pre-existing dialog to be sent in along with a definition 
		buildDialogContents: function(params) {
			params.dialog.content = "";
			return _buildDialogContents(params);
		},
		
		// Builds contents and houses them in a new dialog
		buildDialog: function(params) {
			return _buildDialog(params);
		},
		
		// Uses a preset dialog definition to make a fallback dialog in the event window
		// opening is disabled in this browser
		makeFailoverDialog: function(params) {
			params.definition = DialogDefs.makeFailoverDef(params);
			return _buildDialog(params);				
		},

		// Makes a generic 'error' dialog using the Error dialog definition which will display 
		// an error icon, title, and message
		makeBasicErrorDialog: function(params) {
			params.definition = DialogDefs.makeBasicErrorDef(params.content,params.title);
			
			var okCmd = params.definition.dialogElementCollections.mainPane.collectionElements.bottom[0].events.click;
			
			okCmd.cmdAction = params.okCmdAction;	
			okCmd.cmdFunction = params.okCmdFunction;		
			declare.safeMixin(okCmd.parameters,params.okCmdParameters);
			params.definition.cancel = params.cancelAction;	
			
			params.definition.parameters.id += "_" + utils.makeId();
			
			return _buildDialog(params);
		},
		
		// Makes a simple yes/no dialog; allows for actions to be provided for yes and no events.
		makeYesNoDialog: function(params) {
			params.definition = DialogDefs.makeYesNoDef(params.content,params.title);
			var yesCmd = params.definition.dialogElementCollections.mainPane.collectionElements.bottom[0].events.click;
			var noCmd = params.definition.dialogElementCollections.mainPane.collectionElements.bottom[1].events.click;
			
			yesCmd.cmdAction = params.yesCmdAction;	
			noCmd.cmdAction = params.noCmdAction;	
			yesCmd.cmdFunction = params.yesCmdFunction;	
			noCmd.cmdFunction = params.noCmdFunction;	
			params.definition.cancel = params.cancelAction;	
			declare.safeMixin(yesCmd.parameters,params.yesCmdParameters);
			declare.safeMixin(noCmd.parameters,params.noCmdParameters);
			
			params.definition.parameters.id += "_" + utils.makeId();
			
			return _buildDialog(params);	
		},

		// Generates the 'Keymap' dialog based on the KEYMAP definition in the DialogDefinitions module
		makeKeymapDialog: function(params) {
			if(!params) {
				params = {};
			}
			params.definition = DialogDefs.getDialogDef("KEYMAP");
			if(params.clientMode) {
				var modelTab = params.definition.dialogElementCollections.mainPane.collectionElements.center[0].collectionElements["0"];
				var menuTab = params.definition.dialogElementCollections.mainPane.collectionElements.center[0].collectionElements["1"];
				var modelTreeTab = params.definition.dialogElementCollections.mainPane.collectionElements.center[0].collectionElements["2"];
				
				var tabContents = (params.clientMode === "EDITOR" ? TextMsgs.keyMapEditor : TextMsgs.keyMapViewer);
				
				modelTab.parameters.title = tabContents.modelTabTitle;
				menuTab.parameters.title = tabContents.menuTabTitle;
				modelTreeTab.parameters.title = tabContents.modelTreeTabTitle;
				
				modelTab.parameters.content = tabContents.modelTabContent;
				menuTab.parameters.content = tabContents.menuTabContent;
				modelTreeTab.parameters.content = tabContents.modelTreeTabContent;
			}
			
			if(params.cancelAction) {
				params.definition.cancel = params.cancelAction;	
			}
			
			return _buildDialog(params);
		},
				
		// Generates the 'About' dialog based on the ABOUT definition in the DialogDefinitions module
		makeAboutDialog: function(params) {
			if(!params) {
				params = {};
			}
			params.definition = DialogDefs.getDialogDef("ABOUT");
			if(params.clientMode) {
				params.definition.dialogElementCollections.mainPane.collectionElements.center[1].parameters.content = 
					(params.clientMode === "EDITOR" ? TextMsgs.aboutEditor : TextMsgs.aboutViewer);
			}
			
			if(params.cancelAction) {
				params.definition.cancel = params.cancelAction;	
			}
			
			return _buildDialog(params);
		},
		
		// Generates the 'Zoom Warning' dialog
		makeZoomWarnDialog: function(params) {
			if(!params) {
				params = {};
			}
			params.definition = DialogDefs.getDialogDef("ZOOM_WARNING");
			params.definition.dialogElementCollections.mainPane.collectionElements.center[0].parameters.content = TextMsgs.zoomWarning(params.type);

			if(params.cancelAction) {
				params.definition.cancel = params.cancelAction;	
			}
			
			return _buildDialog(params);
		},
		
		// If we are in Editor mode, generates the ColorEditor dialog
		makeColorEdDialog: function(params) {
			if(params.clientMode !== "EDITOR") {
				return null;
			}
			
			params = params || {};
			params.definition = DialogDefs.getDialogDef("COLOR_EDITOR");
			
			if(params.cancelAction) {
				params.definition.cancel = params.cancelAction;	
			}
			
			if(params.openVal) {
				params.definition.dialogElementCollections.mainPane.collectionElements.center[0].parameters.openVal = params.openVal;
			}
			
			if(params.colorChoices) {
				params.definition.dialogElementCollections.mainPane.collectionElements.center[0].parameters.colorChoices = params.colorChoices;
			}
			
			return _buildDialog(params);
		},
		
		makeNewStackPage:function(pageDef,forDialog,stackContainer,scParams,selectNewPage) {
			var labels = new Array(), textMsgs = new Array();
						
			var newPage = _buildElementList(forDialog,[pageDef],"center",stackContainer,scParams,labels,textMsgs);
			
			stackContainer.addChild(newPage);
			
			DojoArray.forEach(textMsgs,function(message){
				_addTextBlock(message);
			});
			
			DojoArray.forEach(labels,function(label){
				_makeLabel(label);
			});
			
			selectNewPage && stackContainer.selectChild(newPage);
		}
	};
});