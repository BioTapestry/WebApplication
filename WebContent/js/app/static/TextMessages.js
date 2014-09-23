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

define(["dojo/text!./build.info"],function(buildText){
	
	var buildInfo = JSON.parse(buildText);	
	
	var mainText = "<p>BioTapestry Web {TYPE} Version "+buildInfo.BTWVERSION+"/BioTapestry Version "+buildInfo.BTVERSION+" ("+buildInfo.DATE
	+ ")</p><p>BioTapestry software is Copyright (C) 2003-" + new Date().getFullYear() + ", Institute for Systems Biology. It is released under "
	+ "the GNU Lesser General Public License, a copy of which may be found <a target=\"_blank\" href=\"licenses/LICENSE\">here</a>.</p>"
	+ "<p>The Javascript libraries used in the BioTapestry Web Client are covered by the following licenses:<ul>"
	+ "<li><a href=\"licenses/LICENSE-Dojo\" target=\"_blank\">Dojo</a><li><a href=\"licenses/LICENSE-Underscore\" target=\"_blank\">Underscore</a>"
	+ "<li><a href=\"licenses/LICENSE-dgrid\" target=\"_blank\">dgrid</a>, <a href=\"licenses/LICENSE-put-selector\" target=\"_blank\">put-selector</a>, " 
	+ "<a href=\"licenses/LICENSE-xstyle\" target=\"_blank\">xstyle</a></ul></p><p>Flexjson is covered by the <a href=\"licenses/LICENSE-flexjson\""
	+ "target=\"_blank\">Apache License Version 2.0</a>.</p><p>Some of the toolbar icon images in this package are covered by the following free distribution license:"
	+ "<ul><li><a target=\"_blank\" href=\"licenses/LICENSE-SUN\">Sun Microsystems</a></li></ul></p>";
	
	return {
		aboutViewer: mainText.replace("{TYPE}","Viewer")
		,aboutEditor: mainText.replace("{TYPE}","Editor")
	};
});