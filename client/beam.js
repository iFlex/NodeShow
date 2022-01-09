import { bridge } from "./nodeshow.js";

function tryBeam() {
    console.log("Attempting to beam HTML content")
    try {
        bridge.beam(true)
        console.log("Finished beaming HTML content")
    } catch (e) {
        console.log(`Coult not beam ${e}.`)
        setTimeout(tryBeam, 100)
    }
}

tryBeam();