import {Container} from "./Container.js";
import "./container.serialization.js"
import "./container.positioning.js";
import "./container.sizing.js"
import "./container.staticcontent.js";
import "./container.actions.js";
import "./container.summarize.js";
import "./container.reference.js";
import "./container.camera.js";

let root = document.getElementById('nodeshow-content')
if (!root) {
    console.log(`No nodeshow-content container fount. Initialising engine on document.body`)
    root = document.body
}

let container = new Container(root, false);
container.init();

export {container as container}