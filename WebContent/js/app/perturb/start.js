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

/**
 * The Perturbation start.js. This will make sure all of the libraries load for
 * these data subwindows.
 * 
 */

require({
	baseUrl: '../js/',
	tlmSiblingOfDojo: false,
	packages: [
       	/* Dojo Libraries */
       { name: "dojo", location: "lib/dojo"},
       { name: "dojox", location: "lib/dojox"},
       { name: "dijit", location: "lib/dijit"},
       /* Our libraries and app */
       { name: "static", location: "app/static"},
       { name: "widgets", location: "app/ui/widgets"},
       { name: "dialogs", location: "app/ui/dialogs"},
       { name: "ui", location: "app/ui"},       
       { name: "views", location: "app/views"},
       { name: "models", location: "app/models"},
       { name: "controllers", location: "app/controllers"},
       { name: "app", location: "app" },
       { name: "utils", location: "lib/utils"},
       { name: "perturb", location: "app/perturb"}
	]
},['perturb']);