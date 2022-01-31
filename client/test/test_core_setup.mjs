import {Container} from "../Container.js";
import "../container.serialization.js"
import "../container.positioning.js";
import "../container.sizing.js"
import "../container.staticcontent.js";
import "../container.actions.js";
import "../container.summarize.js";
import "../container.camera.js";

let container = new Container(document.body, false);
container.init();
container.makeCamera(document.documentElement, container.parent);

export { container as container }