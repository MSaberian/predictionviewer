import { interpolate } from "d3";
import fs from 'fs';

async function viewerScene(BABYLON, engine, currentScene, canvas, userId, gender = "m") {
    const { Vector3, Scene, MeshBuilder, StandardMaterial, Color3, ArcRotateCamera, DirectionalLight, CubeTexture, ShadowGenerator, SceneLoader, MorphTargetManager, Texture } = BABYLON;

    const scene = new Scene(engine);
    window.addEventListener("resize", () => {
        engine.resize();
    });

    function createCylinder(name, diameter, height, position, scene) {
        const cylinder = MeshBuilder.CreateCylinder(name, { diameter, height, tessellation: 64 }, scene);
        cylinder.position = position;

        const cylinderMaterial = new StandardMaterial(name + "Mat", scene);
        cylinderMaterial.diffuseColor = new Color3(0.8, 0.8, 0.8);
        cylinder.material = cylinderMaterial;
        shadowGenerator.getShadowMap().renderList.push(cylinder);
        cylinder.receiveShadows = true;
    }

    const scanOffset = 3;

    const camera = new ArcRotateCamera("camera", Math.PI * 0.5, Math.PI * 0.5, 8, new Vector3(-scanOffset / 4, 1.2, 0), scene);
    camera.position = new Vector3(camera.position.x, camera.position.y, camera.position.z - 3);
    camera.attachControl(canvas, true);
    camera.inertia = 0.8;
    camera.angularSensibility = 1000;
    camera.lowerRadiusLimit = .1;
    camera.upperRadiusLimit = 10;
    camera.wheelPrecision = 30;
    camera.minZ = 0.01;
    //fasdfa

    scene.createDefaultEnvironment({
        skyboxColor: new Color3(0.8, 0.8, 0.8),
        groundColor: Color3.Black
    });

    const hdrTexture = CubeTexture.CreateFromPrefilteredData("./hdris/environment.env", scene);
    scene.environmentTexture = hdrTexture;

    const lightDirection = new Vector3(-1, -2, -1);
    const directionalLight = new DirectionalLight("dir01", lightDirection, scene);
    const shadowGenerator = new ShadowGenerator(1024, directionalLight);

    createCylinder("cylinder_top", 2, 0.2, new Vector3(0, 0.1, 0), scene);
    createCylinder("cylinder_bottom", 3, 0.1, new Vector3(0, 0, 0), scene);

    createCylinder("cylinder_top_scan", 2, 0.2, new Vector3(-scanOffset / 2, 0.1, 0), scene);
    createCylinder("cylinder_bottom_scan", 3, 0.1, new Vector3(-scanOffset / 2, 0, 0), scene);
    const config = await fetch(`./${userId}_gltfs/weights_mass_tone_ranges.json`).then(res => res.json());
    let initMass = config["initial_mass"]
    let initTone = config["initial_tone"]
    const gltf_name = `${userId}_initial_mass_${parseFloat(initMass).toFixed(2)}_tone_${parseFloat(initTone).toFixed(2)}`;

    const userInitResult = await SceneLoader.ImportMeshAsync("", `./${userId}_gltfs/`, `${gltf_name}.gltf`, scene);
    let initialMesh;

    if (gender === "m") {
        initialMesh = userInitResult.meshes.find((m) => m.name === "m_ca01");
        initialMesh.isVisible = true;
    } else {
        initialMesh = userInitResult.meshes.find((m) => m.name === "f_ca01");
    }

    if (initialMesh) {
        initialMesh.position.y = 0.2;
    }

    let scan;
    scan = userInitResult.meshes.find((m) => m.name == "scan_model");
    let scanMaterial;
    if (scan) {
        scan.position = new Vector3(scanOffset / 2, 0.21, 0);
        console.log("scan material: ", scan.material);

        // Separate material for the scan
        scanMaterial = scan.material.clone("scanMaterialClone"); // Clone the original scan material
        const grayScaleValue = 0.75;
        scanMaterial.albedoColor = new Color3(grayScaleValue, grayScaleValue, grayScaleValue);
        shadowGenerator.getShadowMap().renderList.push(scan);
        scan.receiveShadows = true;

        scanMaterial.roughness = 1.0;
        scanMaterial.metallic = 0.5;
    }

    // Create a new material for the initialMesh (character mesh)
    const characterMaterial = scanMaterial.clone("characterMaterialClone"); // Clone the scan material for the character
    initialMesh.material = characterMaterial;

    // Setup texture toggle specifically for the character material
    setupTextureToggle(characterMaterial);

    setupMaterialSliders(scanMaterial, characterMaterial);
    setupColorPicker(scanMaterial, characterMaterial);
    setupGrayScaleSlider(scanMaterial, characterMaterial, 0.75);

    function setupMaterialSliders(scanMaterial, characterMaterial) {
        const roughnessSlider = document.getElementById('roughnessSlider');
        const roughnessValueDisplay = document.getElementById('roughnessValue');
        const metallicSlider = document.getElementById('metallicSlider');
        const metallicValueDisplay = document.getElementById('metallicValue');

        roughnessSlider.addEventListener('input', function () {
            const roughnessValue = parseFloat(this.value);
            scanMaterial.roughness = roughnessValue;
            characterMaterial.roughness = roughnessValue;
            roughnessValueDisplay.textContent = roughnessValue.toFixed(2);
        });

        metallicSlider.addEventListener('input', function () {
            const metallicValue = parseFloat(this.value);
            scanMaterial.metallic = metallicValue;
            characterMaterial.metallic = metallicValue;
            metallicValueDisplay.textContent = metallicValue.toFixed(2);
        });
    }

    function setupColorPicker(scanMaterial, characterMaterial) {
        const colorPicker = document.getElementById('albedoColorPicker');

        colorPicker.addEventListener('input', function () {
            const color = BABYLON.Color3.FromHexString(this.value);
            scanMaterial.albedoColor = color;
            characterMaterial.albedoColor = color;
        });
    }

    function setupGrayScaleSlider(scanMaterial, characterMaterial, initialGrayScaleValue) {
        const grayScaleSlider = document.getElementById('grayScaleSlider');
        const grayScaleValueDisplay = document.getElementById('grayScaleValue');

        grayScaleSlider.addEventListener('input', function () {
            const grayScaleValue = parseFloat(this.value);
            scanMaterial.albedoColor = new Color3(grayScaleValue, grayScaleValue, grayScaleValue);
            characterMaterial.albedoColor = new Color3(grayScaleValue, grayScaleValue, grayScaleValue);
            grayScaleValueDisplay.textContent = grayScaleValue.toFixed(2);
        });

        grayScaleValueDisplay.textContent = initialGrayScaleValue.toFixed(2);
    }

    function setupTextureToggle(material) {
        const textureToggle = document.getElementById('textureToggle');
        const texture = new Texture("./textures/body_diffuse.png", scene);

        // Invert the UVs by setting the scale to -1 on the desired axis
        texture.uScale = -1; // Inverts the UVs horizontally
        texture.vScale = -1; // Inverts the UVs vertically

        textureToggle.addEventListener('change', function () {
            if (this.checked) {
                material.albedoTexture = texture;
            } else {
                material.albedoTexture = null;
            }
        });
    }

    if (initialMesh) {
        console.log("initialMesh material: ", initialMesh.material);
        shadowGenerator.getShadowMap().renderList.push(initialMesh);
        initialMesh.receiveShadows = true;

        const morphTargetManager = new MorphTargetManager();
        initialMesh.morphTargetManager = morphTargetManager;

        const targets = setupTargets(morphTargetManager);
        console.log("targets:", targets);
        const data = await fetchData();
        const gltfMeshes = await setupMorphTargets(initialMesh, config, morphTargetManager, targets, data);
        
        function setupTargets(morphTargetManager) {
            let targets = [];
            for (let i = 0; i < morphTargetManager.numTargets; i++) {
                const target = morphTargetManager.getTarget(i);
                const [morphMass, morphTone] = target.name.split('_').slice(1, 3).map(Number);
                targets.push({ index: i, mass: morphMass, tone: morphTone });
            }
            return targets;
        }

        async function setupMorphTargets(mesh, config, morphTargetManager, targets, data) {
            let promises = config.mass_tone_weight_combination.map(([mass, tone, weight]) => {
                let filename = `${userId}_mass_${mass.toFixed(2)}_tone_${tone.toFixed(2)}_weight_${weight.toFixed(2)}.gltf`;
                return SceneLoader.ImportMeshAsync("", `./${userId}_gltfs/`, filename, scene)
                    .then(result => {
                        const morphTarget = new BABYLON.MorphTarget(`morph_${mass.toFixed(2)}_${tone.toFixed(2)}_${weight.toFixed(2)}`);
                        const originalPositions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
                        const newMesh = result.meshes.reduce((maxMesh, currentMesh) => {
                            const maxVerticesCount = maxMesh.getTotalVertices();
                            const currentVerticesCount = currentMesh.getTotalVertices();
                            return currentVerticesCount > maxVerticesCount ? currentMesh : maxMesh;
                        }, result.meshes[0]);
                        const newPositions = newMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);

                        if (originalPositions.length !== newPositions.length) {
                            console.error("Vertex count mismatch. Expected:", originalPositions.length / 3, "Got:", newPositions.length / 3);
                            return;
                        }

                        morphTarget.setPositions(newPositions);
                        morphTargetManager.addTarget(morphTarget);

                        // Hide the new mesh
                        result.meshes.forEach(m => m.isVisible = false);

                    })
                    .catch(err => {
                        console.error("Failed to fetch or process morph target data:", err);
                    });
            });

            await Promise.all(promises);
            console.log("All morph targets processed.");

            // Set all morph target influences to zero initially
            for (let i = 0; i < morphTargetManager.numTargets; i++) {
                morphTargetManager.getTarget(i).influence = 0;
            }
            setupSliders
            // Set the initial visibility of the mesh
            mesh.isVisible = true;
            updateMorphTargets(initMass, initTone, morphTargetManager, mesh, config.mass_tone_weight_combination, targets);
            await updateDisplayValues(initMass, initTone, config);
        }

        function getLinearInterpolatedValue(minValue, maxValue, factor) {
            return minValue + factor * (maxValue - minValue);
        }

        function getMinMaxValues(data) {
            let minFat = Number.MAX_VALUE, maxFat = -Number.MAX_VALUE;
            let minMuscle = Number.MAX_VALUE, maxMuscle = -Number.MAX_VALUE;
            let minWeight = Number.MAX_VALUE, maxWeight = -Number.MAX_VALUE;

            data.forEach(entry => {
                minFat = Math.min(minFat, parseFloat(entry.fat));
                maxFat = Math.max(maxFat, parseFloat(entry.fat));
                minMuscle = Math.min(minMuscle, parseFloat(entry.muscle));
                maxMuscle = Math.max(maxMuscle, parseFloat(entry.muscle));
                minWeight = Math.min(minWeight, parseFloat(entry.weight));
                maxWeight = Math.max(maxWeight, parseFloat(entry.weight));
            });

            return {
                minFat, maxFat,
                minMuscle, maxMuscle,
                minWeight, maxWeight
            };
        }

        async function fetchData() {
            const data = await d3.csv(`./scrolls/scroll_${userId}.csv`, d => ({
                mass: +d.mass,
                tone: +d.tone,
                fat: +d.fat,
                muscle: +d.muscle,
                weight: +d.weight
            }));
            return data;
        }

        function interpolatedBasedOnMass(d0, d1, massValue, tonValue){
            var result = Object.assign({}, d0);
            result.mass = massValue;
            result.tone = tonValue;
            result.fat = ((Math.abs(massValue - d1.mass)*d0.fat) + (Math.abs(massValue-d0.mass)*d1.fat))/Math.abs(d0.mass - d1.mass);
            result.muscle = ((Math.abs(massValue - d1.mass)*d0.muscle) + (Math.abs(massValue-d0.mass)*d1.muscle)) / Math.abs(d0.mass - d1.mass);
            result.weight = ((Math.abs(massValue - d1.mass)*d0.weight) + (Math.abs(massValue-d0.mass)*d1.weight)) / Math.abs(d0.mass - d1.mass);
            return result;
        }
        function interpolatedBasedOnTone(d0, d1, tonValue){
            var result = Object.assign({}, d0);
            result.tone = tonValue;
            result.fat = (Math.abs(tonValue - d1.tone)*d0.fat + Math.abs(tonValue-d0.tone)*d1.fat) / Math.abs(d0.tone - d1.tone)
            result.muscle = (Math.abs(tonValue - d1.tone)*d0.muscle + Math.abs(tonValue-d0.tone)*d1.muscle) / Math.abs(d0.tone - d1.tone)
            result.weight = (Math.abs(tonValue - d1.tone)*d0.weight + Math.abs(tonValue-d0.tone)*d1.weight) / Math.abs(d0.tone - d1.tone)
            return result;
        }

        function interpolateValues(data, massValue, toneValue) {
            const massesArray = Array.from(new Set( data.map(item => item.mass).sort()));
            const tonesArray = Array.from(new Set(data.map(item => item.tone).sort()));

            let mass0=-1, mass1=-1;
            for (let i = 0; i < massesArray.length - 1; i++) 
                if (massValue >= massesArray[i] && massValue <= massesArray[i + 1]) {
                    mass0 = massesArray[i];
                    mass1 = massesArray[i+1];
                    break;
                }

            let tone0=-1, tone1=-1;
            for (let i = 0; i < tonesArray.length - 1; i++) 
                if (toneValue >= tonesArray[i] && toneValue <= tonesArray[i + 1]) {
                    tone0 = tonesArray[i];
                    tone1 = tonesArray[i+1];
                    break;
                }    

            console.log("massesArray:", massesArray);
            console.log("mass0:", mass0);
            console.log("mass1:", mass1);
            console.log("massValue:", massValue);
            console.log("toneValue:", mass1);
            
            const massPoints1 = data.find(c=> (c.mass == mass0 && c.tone == tone0));
            const massPoints2 = data.find(c=> (c.mass == mass1 && c.tone == tone0));
            console.log("massPoints2:", massPoints2);
            const interPointMass0 = interpolatedBasedOnMass(massPoints1, massPoints2, massValue , tone0);

            const massPoints3 = data.find(c=> (c.mass == mass0 && c.tone == tone1));
            const massPoints4 = data.find(c=> (c.mass == mass1 && c.tone == tone1));
            const interPointMass1 = interpolatedBasedOnMass(massPoints3, massPoints4, massValue , tone1);

            const interPointTone = interpolatedBasedOnTone(interPointMass0, interPointMass1, toneValue);
            
            let interpolatedFat = 0, interpolatedMuscle = 0, interpolatedWeight = 0;
             interpolatedFat = interPointTone.fat;
             interpolatedMuscle = interPointTone.muscle;
             interpolatedWeight = interPointTone.weight;
             
            // const interpoletedPoints = data.filter(c=> (c.mass == mass0 && c.tone == tone0) || (c.mass == mass0 && c.tone == tone1) || 
            // (c.mass == mass1 && c.tone == tone0) || (c.mass == mass1 && c.tone == tone1));
            // let nearestPoints = interpoletedPoints.map(d => ({
            //     ...d, 
            //     distance: Math.sqrt(Math.pow(d.mass - massValue, 2) + Math.pow(d.tone - toneValue, 2))
            // }));

            // nearestPoints.sort((a, b) => a.distance - b.distance);

            // if (nearestPoints.length === 0) {
            //     return { fat: NaN, muscle: NaN, weight: NaN };
            // }
            // test
            // if (nearestPoints[0].distance === 0) {
            //     return {
            //         fat: nearestPoints[0].fat,
            //         muscle: nearestPoints[0].muscle,
            //         weight: nearestPoints[0].weight
            //     };
            // }

            // const totalWeight = nearestPoints.reduce((acc, point) => acc + (1 / point.distance || 1), 0);
            // nearestPoints = nearestPoints.map(d => ({
            //     ...d, 
            //     effect: ((1 / d.distance || 1) /totalWeight)
            // }));
            
            // nearestPoints.forEach(point => {
            //     interpolatedFat += point.fat * point.effect;
            //     interpolatedMuscle += point.muscle * point.effect;
            //     interpolatedWeight += point.weight * point.effect;
            // });

            if (interpolatedFat + interpolatedMuscle > interpolatedWeight) {
                const total = interpolatedFat + interpolatedMuscle;
                const ratio = interpolatedWeight / total;
                interpolatedFat *= ratio;
                interpolatedMuscle *= ratio;
                console.error("weight kuchiktareeeeee vaveylaaa");
            }

            return {
                fat: interpolatedFat,
                muscle: interpolatedMuscle,
                weight: interpolatedWeight
            };
        }

        async function updateDisplayValues(massValue, toneValue, config) {
            const data = await fetchData();
            const interpolatedValues = interpolateValues(data, massValue, toneValue);
            
            document.getElementById('fatValue').textContent = interpolatedValues.fat.toFixed(2);
            document.getElementById('muscleValue').textContent = interpolatedValues.muscle.toFixed(2);
            document.getElementById('weightValue').textContent = interpolatedValues.weight.toFixed(2);
        }

        function findNearestPoints(xArray, xValue) {
            let x0=-1, x1=-1;
            for (let i = 0; i < xArray.length - 1; i++) 
                if (xValue >= xArray[i] && xValue <= xArray[i + 1]) {
                    x0 = xArray[i];
                    x1 = xArray[i+1];
                    return [x0, x1];
                }
            return [x0, x1];
        }

        async function updateMorphTargets(massValue, toneValue, morphTargetManager, mesh, combinations, targets) {
            const data = await fetchData();
            if (morphTargetManager && morphTargetManager.numTargets > 0) {
                const massesArray = Array.from(new Set(data.map(item => item.mass).sort()));
                const tonesArray = Array.from(new Set(data.map(item => item.tone).sort()));
                let targets = [];
                console.log("massesArray[0]:", massesArray[0]*1000000000000000);
                console.log("tonesArray:", tonesArray);
                for (let i = 0; i < morphTargetManager.numTargets; i++) {
                // for (let i = 0; i < 4; i++) {
                    const target = morphTargetManager.getTarget(i);
                    const [morphMass, morphTone] = target.name.split('_').slice(1, 3).map(Number);
                    targets.push({ index: i, mass: morphMass, tone: morphTone });
                }

                // const masss = findNearestPoints(massesArray, massValue);
                // const tones = findNearestPoints(tonesArray, toneValue);

                // for (const mass of masss){
                //     for (const tone of tones){
                //         targets.push({index: targets.length, mass: mass, tone: tone});                        
                //     }
                // }
                // console.log("masss:", masss);
                // console.log("tones:", tones);
                // // targets = [];
                // console.log("targets:", targets);

                let influences = targets.map(target => {
                    let distance;
                    let weight = 0;
                    if (Math.abs(massValue - target.mass) < 0.2 && Math.abs(toneValue - target.tone) < 0.15){
                        distance = Math.sqrt(Math.pow((massValue - target.mass)/0.2, 2) + Math.pow((toneValue - target.tone)/0.15, 2));
                        if (distance==0) {
                            distance = 0.000000001;
                        }
                        weight = 0.2/distance;
                    }
                    // const weight = Math.exp(-distance * 10);
                    return { ...target, weight };
                });

                console.log("influences:", influences);
                const totalWeight = influences.reduce((sum, target) => sum + target.weight, 0);
                influences = influences.map(target => ({ ...target, influence: target.weight / totalWeight }));

                for (let i = 0; i < influences.length; i++) {
                    const target = influences[i];
                    morphTargetManager.getTarget(target.index).influence = target.influence;

                    // if (target.influence >= 0.98){
                    //     target.influence = 1;
                    //     target.isVisible = true;
                    // }

                    // if (target.influence <= 0.02){
                    //     target.influence = 0;
                    //     target.isVisible = false;
                    // }

                }

                console.log("Updated influences:", influences);
            } else {
                console.error("No morph targets found in the morph target manager.");
            }
        }

        let massRange = [], toneRange=[];
        function setupSliders(config, morphTargetManager, initialMesh, gltfMeshes, targets) {
            const massSlider = document.getElementById('massMorphSlider');
            const toneSlider = document.getElementById('toneMorphSlider');
            const massValueDisplay = document.getElementById('massMorphValue');
            const toneValueDisplay = document.getElementById('toneMorphValue');

            massRange = [parseFloat(Math.min(...config.mass_tone_weight_combination.map(d => d[0])).toFixed(2)), parseFloat(Math.max(...config.mass_tone_weight_combination.map(d => d[0])).toFixed(2))];
            toneRange = [parseFloat(Math.min(...config.mass_tone_weight_combination.map(d => d[1])).toFixed(2)), parseFloat(Math.max(...config.mass_tone_weight_combination.map(d => d[1])).toFixed(2))];
            
            massSlider.value = ((initMass - massRange[0]) / (massRange[1] - massRange[0])) * 100;
            toneSlider.value = ((initTone - toneRange[0]) / (toneRange[1] - toneRange[0])) * 100;

            massValueDisplay.textContent = initMass.toFixed(2);
            toneValueDisplay.textContent = initTone.toFixed(2);

            updateMorphTargets(initMass, initTone, morphTargetManager, initialMesh, config.mass_tone_weight_combination, gltfMeshes, targets);
            updateDisplayValues(initMass, initTone, config);
            
            console.log("massSlider.value:", massSlider.value);

            massSlider.addEventListener('input', function () {
                // console.log("this.value:", this.value);
                // debugger;
                const massValue = parseFloat(this.value) / 100 * (massRange[1] - massRange[0]) + massRange[0];
                // console.log("massValue:", massValue);
                massValueDisplay.textContent = massValue.toFixed(2);
                // console.log("textContent:", massValueDisplay.textContent );
                updateMorphTargets(massValue, parseFloat(toneValueDisplay.textContent), morphTargetManager, initialMesh, config.mass_tone_weight_combination, gltfMeshes, targets);
                updateDisplayValues(massValue, parseFloat(toneValueDisplay.textContent), config);
            });

            toneSlider.addEventListener('input', function () {
                const toneValue = parseFloat(this.value) / 100 * (toneRange[1] - toneRange[0]) + toneRange[0];
                toneValueDisplay.textContent = toneValue.toFixed(2);
                updateMorphTargets(parseFloat(massValueDisplay.textContent), toneValue, morphTargetManager, initialMesh, config.mass_tone_weight_combination, gltfMeshes, targets);
                updateDisplayValues(parseFloat(massValueDisplay.textContent), toneValue, config);
            });
        }

        function setupLightingAndShadows(BABYLON, directionalLight, shadowGenerator, scene) {
            directionalLight.position = new BABYLON.Vector3(20, 40, 20);
            directionalLight.diffuse = new BABYLON.Color3(1, 1, 1);
            directionalLight.specular = new BABYLON.Color3(1, 1, 1);
            directionalLight.intensity = 1;

            directionalLight.shadowMaxZ = 130;
            directionalLight.shadowMinZ = 10;
            shadowGenerator.useContactHardeningShadow = true;
            shadowGenerator.setDarkness(0.5);
        }

        function setupCheckboxes(mesh) {
            const wireframeCheckbox = document.getElementById('wireframeView');

            wireframeCheckbox.addEventListener('change', function () {
                mesh.material.wireframe = this.checked;
            });
        }

        setupSliders(config, morphTargetManager, initialMesh, gltfMeshes, targets);
        setupLightingAndShadows(BABYLON, directionalLight, shadowGenerator, scene);
        setupCheckboxes(initialMesh);
        setupCheckboxes(scan);

        if (currentScene) {
            currentScene.dispose();
        }

        engine.runRenderLoop(() => {
            scene.render();
        });

        return scene;
    } else {
        console.error("Mesh 'm_ca01' not found in the imported GLTF.");
    }
}

export default viewerScene;

document.addEventListener('DOMContentLoaded', () => {
    const dataNames = ["01", "02", "03", "04", "05", "06", "07", "08", "altafi", "ensafiniya", "feyzi", "hashemi", "kafashi", "nakhaei", "payman", "shams"];

    const dataListContainer = document.getElementById('dataList');
    const loadDataButton = document.getElementById('loadDataButton');

    dataNames.forEach((name) => {
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'dataName';
        radio.value = name;
        radio.id = name;

        const label = document.createElement('label');
        label.htmlFor = name;
        label.appendChild(document.createTextNode(name));

        const div = document.createElement('div');
        div.appendChild(radio);
        div.appendChild(label);

        dataListContainer.appendChild(div);
    });

    loadDataButton.addEventListener('click', () => {
        const selectedData = document.querySelector('input[name="dataName"]:checked');
        if (selectedData) {
            loadViewerScene(selectedData.value);
        } else {
            alert('Please select a data item');
        }
    });

    async function loadViewerScene(userId) {
        if (window.currentScene) {
            window.currentScene.dispose();
        }

        const defaultValues = {
            "01": { gender: "f"},
            "02": { gender: "f"},
            "03": { gender: "f"},
            "04": { gender: "f"},
            "05": { gender: "f"},
            "06": { gender: "f"},
            "07": { gender: "f"},
            "08": { gender: "f"},
            "shams": { gender: "m"},
            "payman": { gender: "m"},
            "kafashi": { gender: "m"},
            "nakhaei": { gender: "m"},
            "hashemi": { gender: "m"},
            "feyzi": { gender: "m"},
            "ensafiniya": { gender: "m"},
            "altafi": { gender: "m", initMass: 0.2, initTone: 0.00 },
        };

        const userConfig = defaultValues[userId] || { gender: "m"};
        const { gender } = userConfig;

        const engine = new BABYLON.Engine(document.querySelector('canvas'), true);

        viewerScene(BABYLON, engine, window.currentScene, document.querySelector('canvas'), userId, gender)
            .then(scene => {
                window.currentScene = scene;
            })
            .catch(err => console.error("Error loading the scene:", err));
    }
});
