export class FontManager {
    
    #container = null
    
    #defaultGoogleFonts = ['Roboto', 'Dongle','Open Sans', 'Rubik Beastly', 
    'Lato', 'Mochiy Pop P One','Montserrat','Sedgwick Ave',
    'Raleway', 'Nunito', 'Ubuntu', 'Playfair Display', 'Luxurious Roman',
    'Source Code Pro','Dancing Script', 'Lobster', 'Pacifico', 'Shadows Into Light',
    'Caveat', 'Archivo Narrow', 'Architects Daughter', 'Noto Sans Display', 'Amatic SC',
    'Satisfy']

    #defaults = {}
    #loaded = new Set()

    constructor(container) {
        this.#container = container
        this.#init()
    }

    #initGoogleFonts() {
        for (const fontName of this.#defaultGoogleFonts) {
            this.#defaults[fontName] = {
                "url":`https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}&display=swap`
            }
        }
    }

    #init() {
        this.#initGoogleFonts();

        for (const [name, record] of Object.entries(this.#defaults)) {
            if (record.url) {
                this.#container.loadStyle(record.url, null, true);
                this.#loaded.add(name)
            }
        }
    }

    addFont() {

    }

    uploadFont() {

    }

    listFonts() {
        return Array.from(this.#loaded)
    }
}