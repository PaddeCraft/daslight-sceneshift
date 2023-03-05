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
    // from file get group scenes, where the bank & scenes are located
    var scene_banks = xml.querySelector("SCENES");
    var scene_banks_array = []; // List of all banks with containing scenes
    // iterate through the groups
    for (var i = 0; i < scene_banks.children.length; i++) {
        var bank = scene_banks.children[i];
        // if the group is a bank:
        if (bank.tagName == "BANK") {
            var bank_scenes = [];
            // iterate trough all scenes in the bank an add them to bank_scenes
            Array.from(bank.children).forEach(function (scene) {
                bank_scenes.push({
                    uuid: scene.getAttribute("DASUID"),
                    name: scene.getAttribute("NAME"),
                    element: scene,
                });
            });
            // Add the final bank to scene_banks_array
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
function click_moveDestScene(uuid) {
    dest_file_xml.querySelector("SCENE[DASUID='" + uuid + "']").remove();
    log("Removed Scene " + uuid);
    let toDel = document.getElementById("src-bank-id-prefix-" + uuid);
    toDel.remove();
}
function shift_scene(uuid_src, bank_uuid_dest) {
    // if bank_uuid_dest does not exist, stop method
    if (!bank_uuid_dest) return;
    //get GUI Object
    let dest_bank_html = document.getElementById(
        "dest-bank-id-prefix-" + bank_uuid_dest
    );
    log("Shifting scene " + uuid_src + " to bank " + bank_uuid_dest);
    // get scene content
    var scene_bank = dest_file_xml.querySelector(
        "BANK[DASUID='" + bank_uuid_dest + "']"
    ).innerHTML;
    // set new scene content
    var scene = source_file_xml.querySelector(
        "SCENE[DASUID='" + uuid_src + "']"
    );

    var missing_scenes = []; // Check for missing scenes if super scene is copied
    scene.querySelectorAll("BLOCK[TYPE='1']").forEach(function (sc_block) {
        sc = sc_block.getAttribute("NAME");

        if (dest_file_xml.querySelector("SCENE[NAME='" + sc + "']") == null) {
            missing_scenes.push(sc);
        }
    });

    let sceneObj = document.createElement("div");
    sceneObj.classList.add("singleScene");
    sceneObj.id = "src-bank-id-prefix-" + uuid_src;
    sceneObj.innerHTML = `
        <h5>${scene.getAttribute("NAME")}</h5>
    <div class="sceneMover" onclick="click_moveDestScene('${uuid_src}')">
        Delete
    </div>`;
    dest_bank_html.appendChild(sceneObj);
    dest_file_xml = new DOMParser().parseFromString(
        dest_file_xml.documentElement.outerHTML.replace(
            scene_bank,
            scene_bank + scene.outerHTML
        ),
        "text/xml"
    );

    if (!(missing_scenes.length == 0)) {
        alert(
            "You just copied a super scene, but it requires scenes, which are missing in your destination file.\n" +
                "The following scenes are missing:\n\n" +
                missing_scenes.join("\n")
        );
        log("Detected missing scenes: " + missing_scenes.toString());
    }
}
/*Array.from(document.getElementsByClassName("tooltip")).forEach((e)=>{
    
});*/

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
const overlay = document.getElementById("overlay");
let mousepos;
document.addEventListener("mousemove", (e) => {
    mousepos = {
        x: e.pageX,
        y: e.pageY,
    };
});
function click_moveSrcScene(uuid) {
    overlay.style.display = "block";
    overlay.children[0].style.top = mousepos.y + "px";
    overlay.children[0].style.left = mousepos.x + "px";
    overlay.children[0].setAttribute("data-overUUID", uuid);
}
function moveSrcScene(bank_uuid) {
    let uuid = overlay.children[0].getAttribute("data-overUUID");
    cancel_shift();
    shift_scene(uuid, bank_uuid);
}
function cancel_shift() {
    overlay.style.display = "none";
    overlay.children[0].removeAttribute("data-overUUID");
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
            // go through every bank
            scene_banks.forEach(function (scbank) {
                var scenes_html = "";
                let bankobj = document.createElement("div");
                bankobj.classList.add("bankSlot");
                bankobj.innerHTML = `
                    <h4>${scbank.name}</h4>
                `;
                document.getElementById("src-scenes").appendChild(bankobj);
                // go through every scene in the scbank
                scbank.scenes.forEach(function (scene) {
                    let sceneObj = document.createElement("div");
                    sceneObj.classList.add("singleScene");
                    sceneObj.innerHTML = `
                        <h5>${scene.name}</h5>
                    <div class="sceneMover" onclick="click_moveSrcScene('${scene.uuid}')">
                        ──►
                    </div>`;
                    bankobj.appendChild(sceneObj);
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
                        <p><select id="${dest_bank_id}" class="dest-scene-bank-dropdown"></select><span id="${sc_id}" class="add"> + </span>
                        ${scene.name}</p>
                    </div>
                    `;
                });
            });
            evt_listeners.forEach(function (listener) {
                $("#" + listener.id).click(listener.f);
            });
        } catch (e) {
            log("Error while loading scene banks from source");
            log(e);
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

            scene_banks.forEach(function (scbank) {
                var scenes_html = "";
                let bankobj = document.createElement("div");
                bankobj.classList.add("bankSlot");
                bankobj.id = "dest-bank-id-prefix-" + scbank.uuid;
                bankobj.innerHTML = `
                    <h4>${scbank.name}</h4>
                `;
                document.getElementById("dest-scenes").appendChild(bankobj);
                let bank = document.createElement("div");
                bank.classList.add("banksel_item");
                bank.innerText = scbank.name;
                bank.onclick = () => {
                    moveSrcScene(scbank.uuid);
                };
                document.getElementById("banksel_menu").appendChild(bank);
                // go through every scene in the scbank
                scbank.scenes.forEach(function (scene) {
                    let sceneObj = document.createElement("div");
                    sceneObj.classList.add("singleScene");
                    sceneObj.id = "src-bank-id-prefix-" + scene.uuid;
                    sceneObj.innerHTML = `
                        <h5>${scene.name}</h5>
                    <div class="sceneMover" onclick="click_moveDestScene('${scene.uuid}')">
                        Delete
                    </div>`;
                    bankobj.appendChild(sceneObj);
                });
            });
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
