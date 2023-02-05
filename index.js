dest_file_xml = null;
source_file_xml = null;

function parse_xml_by_event(e, callback) {
    var reader = new FileReader();
    var file = e.target.files[0];
    var parser = new DOMParser();

    if (file) {
        reader.onload = function (res) {
            var result = parser.parseFromString(res.target.result, "text/xml");
            callback(result);
        };

        reader.readAsText(file);
    } else {
        return null;
    }
}

function get_scene_banks_by_xml(xml) {
    var scene_banks = xml.querySelector("SCENES");
    var scene_banks_array = [];
    for (var i = 0; i < scene_banks.children.length; i++) {
        var bank = scene_banks.children[i];
        if (bank.tagName == "BANK") {
            var bank_scenes = [];
            Array.from(bank.children).forEach(function (scene) {
                bank_scenes.push({
                    uuid: scene.getAttribute("DASUID"),
                    name: scene.getAttribute("NAME"),
                    element: scene,
                });
            });
            scene_banks_array.push({
                name: bank.getAttribute("NAME"),
                uuid: bank.getAttribute("DASUID"),
                scenes: bank_scenes,
            });
        }
    }

    return scene_banks_array;
}

function log(msg) {
    $("#log").append(
        "<div>" + new Date().toLocaleTimeString() + ": " + msg + "</div>"
    );
}

function uuidv4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
        (
            c ^
            (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
        ).toString(16)
    );
}

function shift_scene(uuid_src, bank_uuid_dest) {
    if (!bank_uuid_dest) return;
    log("Shifting scene " + uuid_src + " to bank " + bank_uuid_dest);

    var scene_bank = dest_file_xml.querySelector(
        "BANK[DASUID='" + bank_uuid_dest + "']"
    ).innerHTML;
    var scene = source_file_xml.querySelector(
        "SCENE[DASUID='" + uuid_src + "']"
    );
    dest_file_xml = new DOMParser().parseFromString(
        dest_file_xml.documentElement.outerHTML.replace(
            scene_bank,
            scene_bank + scene.outerHTML
        ),
        "text/xml"
    );
}

function download(filename, text) {
    // https://stackoverflow.com/a/3665147

    log("Download requested, " + text.length + " bytes");

    var element = document.createElement("a");
    element.setAttribute(
        "href",
        "data:text/dvc;charset=utf-8," + encodeURIComponent(text)
    );
    element.setAttribute("download", filename);

    element.style.display = "none";
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

$("#source-file-inp").change(function (e) {
    var invalid = document.getElementById("source-file-invalid");

    parse_xml_by_event(e, function (xml) {
        try {
            source_file_xml = xml;

            invalid.style.display = "none";
            log("Loading scene banks from source...");
            var scene_banks = get_scene_banks_by_xml(xml);
            log("Loaded " + scene_banks.length + " scene banks from source");

            console.log(scene_banks);

            var evt_listeners = [];

            scene_banks.forEach(function (scbank) {
                var scenes_html = "";

                scbank.scenes.forEach(function (scene) {
                    var sc_id = uuidv4();
                    var dest_bank_id = uuidv4();
                    evt_listeners.push({
                        id: sc_id,
                        f: function () {
                            shift_scene(
                                scene.uuid,
                                $("#" + dest_bank_id).val()
                            );
                        },
                    });
                    scenes_html += `
                    <div class="scene">
                        <p><select id="${dest_bank_id}" class="dest-scene-bank-dropdown"></select><span id="${sc_id}" class="pointer"> (+) </span>
                        ${scene.name}</p>
                    </div>
                    `;
                });

                $("#source-scene-area").append(`
                    <div class="scbank">
                        <h3>${scbank.name}</h3>
                        ${scenes_html}
                    </div>
                `);
            });
            evt_listeners.forEach(function (listener) {
                $("#" + listener.id).click(listener.f);
            });
        } catch {
            log("Error while loading scene banks from source");
            invalid.style.display = "block";
        }
    });
});

$("#dest-file-inp").change(function (e) {
    var invalid = document.getElementById("dest-file-invalid");

    parse_xml_by_event(e, function (xml) {
        try {
            dest_file_xml = xml;

            invalid.style.display = "none";
            log("Loading scene banks from destination...");
            var scene_banks = get_scene_banks_by_xml(xml);
            log(
                "Loaded " + scene_banks.length + " scene banks from destination"
            );

            var select_options_html = "";
            scene_banks.forEach(function (scbank) {
                select_options_html += `<option value="${scbank.uuid}">${scbank.name}</option>`;
            });

            document
                .querySelectorAll(".dest-scene-bank-dropdown")
                .forEach(function (ele) {
                    ele.innerHTML = select_options_html;
                });
        } catch {
            log("Error while loading scene banks from source");
            invalid.style.display = "block";
        }
    });
});

$("#save-btn").click(function () {
    download(
        "combined-daslight-project.dvc",
        dest_file_xml.documentElement.outerHTML
    );
});
