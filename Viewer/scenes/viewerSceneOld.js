import * as d3 from 'd3';

const userId = "shams";
const gender = "m";
const initMass = 0.00;
const initTone = 0.09;

async function viewerScene(BABYLON, engine, currentScene, canvas) {
    const { Vector3, Scene, MeshBuilder, StandardMaterial, Color3, ArcRotateCamera, DirectionalLight, CubeTexture, ShadowGenerator, SceneLoader, MorphTargetManager } = BABYLON;

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

    scene.createDefaultEnvironment({
        skyboxColor: new Color3(0.8, 0.8, 0.8),
        groundColor: Color3.Black
    });

    const hdrTexture = CubeTexture.CreateFromPrefilteredData("./hdris/environment.env", scene);
    scene.environmentTexture = hdrTexture;

    const lightDirection = new Vector3(-1, -2, -1);
    const directionalLight = new DirectionalLight("dir01", lightDirection, scene);
    var shadowGenerator = new ShadowGenerator(1024, directionalLight);

    createCylinder("cylinder_top", 2, 0.2, new Vector3(0, 0.1, 0), scene);
    createCylinder("cylinder_bottom", 3, 0.1, new Vector3(0, 0, 0), scene);

    createCylinder("cylinder_top_scan", 2, 0.2, new Vector3(-scanOffset / 2, 0.1, 0), scene);
    createCylinder("cylinder_bottom_scan", 3, 0.1, new Vector3(-scanOffset / 2, 0, 0), scene);

    const gltf_name = `${userId}_initial_mass_${initMass.toFixed(2)}_tone_${initTone.toFixed(2)}`;

    const userInitResult = await SceneLoader.ImportMeshAsync("", `./${userId}_gltfs/`, `${gltf_name}.gltf`, scene);
    let mesh;
    if (gender === "m") {
        mesh = userInitResult.meshes.find((m) => m.name === "m_ca01");
    } else {
        mesh = userInitResult.meshes.find((m) => m.name === "f_ca01");
    }

    let scan;
    scan = userInitResult.meshes.find((m) => m.name == "scan_model");
    if (scan) {
        scan.position = new Vector3(scanOffset / 2, 0.21, 0);
        console.log("scan material: ", scan.material);
        const grayScaleValue = 0.33;
        scan.material.albedoColor = new Color3(grayScaleValue, grayScaleValue, grayScaleValue);
        mesh.material = scan.material;
        shadowGenerator.getShadowMap().renderList.push(scan);
        scan.receiveShadows = true;

        // Set initial roughness and metallic values
        scan.material.roughness = 0.5;
        scan.material.metallic = 0.5;

        // Setup sliders for roughness and metallic
        setupMaterialSliders(scan.material);
        setupColorPicker(scan.material);
        setupGrayScaleSlider(scan.material, grayScaleValue);
    }

    function setupMaterialSliders(material) {
        const roughnessSlider = document.getElementById('roughnessSlider');
        const roughnessValueDisplay = document.getElementById('roughnessValue');
        const metallicSlider = document.getElementById('metallicSlider');
        const metallicValueDisplay = document.getElementById('metallicValue');

        roughnessSlider.addEventListener('input', function () {
            const roughnessValue = parseFloat(this.value);
            material.roughness = roughnessValue;
            roughnessValueDisplay.textContent = roughnessValue.toFixed(2);
        });

        metallicSlider.addEventListener('input', function () {
            const metallicValue = parseFloat(this.value);
            material.metallic = metallicValue;
            metallicValueDisplay.textContent = metallicValue.toFixed(2);
        });
    }

    function setupColorPicker(material) {
        const colorPicker = document.getElementById('albedoColorPicker');

        colorPicker.addEventListener('input', function () {
            const color = Color3.FromHexString(this.value);
            material.albedoColor = color;
        });
    }

    function setupGrayScaleSlider(material, initialGrayScaleValue) {
        const grayScaleSlider = document.getElementById('grayScaleSlider');
        const grayScaleValueDisplay = document.getElementById('grayScaleValue');

        grayScaleSlider.addEventListener('input', function () {
            const grayScaleValue = parseFloat(this.value);
            material.albedoColor = new Color3(grayScaleValue, grayScaleValue, grayScaleValue);
            grayScaleValueDisplay.textContent = grayScaleValue.toFixed(2);
        });

        grayScaleValueDisplay.textContent = initialGrayScaleValue.toFixed(2);
    }

    if (mesh) {
        mesh.position.y += 0.21;
        console.log("mesh material: ", mesh.material);
        shadowGenerator.getShadowMap().renderList.push(mesh);
        mesh.receiveShadows = true;

        const morphTargetManager = new MorphTargetManager();
        mesh.morphTargetManager = morphTargetManager;

        const config = await fetch(`./${userId}_gltfs/weights_mass_tone_ranges.json`).then(res => res.json());
        await setupMorphTargets(mesh, config, morphTargetManager);

        async function setupMorphTargets(mesh, config, morphTargetManager) {
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

            // Set the initial visibility of the mesh
            mesh.isVisible = true;
            updateMorphTargets(initMass, initTone, morphTargetManager, mesh, config.mass_tone_weight_combination);
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

        async function updateDisplayValues(massValue, toneValue, config) {
            const data = await fetchData();
            const { minFat, maxFat, minMuscle, maxMuscle, minWeight, maxWeight } = getMinMaxValues(data);

            console.log('Data:', data);
            console.log('Min/Max Values:', { minFat, maxFat, minMuscle, maxMuscle, minWeight, maxWeight });

            const normalizedMass = (massValue + 0.2) / 0.4; // Normalize to range [0, 1]
            const normalizedTone = (toneValue + 0.3) / 0.6; // Normalize to range [0, 1]

            const fatValue = getLinearInterpolatedValue(minFat, maxFat, normalizedMass);
            const muscleValue = getLinearInterpolatedValue(minMuscle, maxMuscle, normalizedTone);

            // Interpolate weight based on massValue and toneValue
            const weightValue = interpolateWeight(data, massValue, toneValue);

            document.getElementById('fatValue').textContent = fatValue.toFixed(2);
            document.getElementById('muscleValue').textContent = muscleValue.toFixed(2);
            document.getElementById('weightValue').textContent = weightValue.toFixed(2);
        }

        function interpolateWeight(data, massValue, toneValue) {
            // Find the four nearest data points for bilinear interpolation
            const points = data.map(d => ({
                mass: d.mass,
                tone: d.tone,
                weight: d.weight,
                distance: Math.sqrt(Math.pow(d.mass - massValue, 2) + Math.pow(d.tone - toneValue, 2))
            }));

            points.sort((a, b) => a.distance - b.distance);

            // Take the four closest points
            const nearestPoints = points.slice(0, 4);

            // Debugging: Log the nearest points
            console.log('Nearest points for interpolation:', nearestPoints);

            // Check if we have at least one point
            if (nearestPoints.length === 0) {
                return NaN;
            }

            // If we have an exact match, return the weight directly
            if (nearestPoints[0].distance === 0) {
                return nearestPoints[0].weight;
            }

            // Calculate weights for bilinear interpolation
            const totalWeight = nearestPoints.reduce((acc, point) => acc + (1 / point.distance || 0), 0);

            let interpolatedWeight = 0;
            nearestPoints.forEach(point => {
                const weight = (1 / point.distance || 0) / totalWeight;
                interpolatedWeight += point.weight * weight;
            });

            return interpolatedWeight;
        }

        function updateMorphTargets(massValue, toneValue, morphTargetManager, mesh, combinations) {
            if (morphTargetManager && morphTargetManager.numTargets > 0) {
                let targets = [];

                for (let i = 0; i < morphTargetManager.numTargets; i++) {
                    const target = morphTargetManager.getTarget(i);
                    const [morphMass, morphTone] = target.name.split('_').slice(1, 3).map(Number);
                    targets.push({ index: i, mass: morphMass, tone: morphTone });
                }

                let influences = targets.map(target => {
                    const distance = Math.sqrt(Math.pow(massValue - target.mass, 2) + Math.pow(toneValue - target.tone, 2));
                    const weight = 1.0 / (Math.pow(distance, 4) + 0.0001);
                    return { ...target, weight };
                });

                const totalWeight = influences.reduce((sum, target) => sum + target.weight, 0);
                influences = influences.map(target => ({ ...target, influence: target.weight / totalWeight }));

                for (let i = 0; i < influences.length; i++) {
                    const target = influences[i];
                    morphTargetManager.getTarget(target.index).influence = target.influence;
                }

                console.log("Updated influences:", influences);
            } else {
                console.error("No morph targets found in the morph target manager.");
            }
        }

        function setupSliders(config, morphTargetManager, mesh) {
            const massSlider = document.getElementById('massMorphSlider');
            const toneSlider = document.getElementById('toneMorphSlider');
            const massValueDisplay = document.getElementById('massMorphValue');
            const toneValueDisplay = document.getElementById('toneMorphValue');

            const massRange = [Math.min(...config.mass_tone_weight_combination.map(d => d[0])), Math.max(...config.mass_tone_weight_combination.map(d => d[0]))];
            const toneRange = [Math.min(...config.mass_tone_weight_combination.map(d => d[1])), Math.max(...config.mass_tone_weight_combination.map(d => d[1]))];

            massSlider.value = ((initMass - massRange[0]) / (massRange[1] - massRange[0])) * 100;
            toneSlider.value = ((initTone - toneRange[0]) / (toneRange[1] - toneRange[0])) * 100;

            massValueDisplay.textContent = initMass.toFixed(2);
            toneValueDisplay.textContent = initTone.toFixed(2);

            updateMorphTargets(initMass, initTone, morphTargetManager, mesh, config.mass_tone_weight_combination);
            updateDisplayValues(initMass, initTone, config);

            massSlider.addEventListener('input', function () {
                const massValue = parseFloat(this.value) / 100 * (massRange[1] - massRange[0]) + massRange[0];
                massValueDisplay.textContent = massValue.toFixed(2);
                updateMorphTargets(massValue, parseFloat(toneValueDisplay.textContent), morphTargetManager, mesh, config.mass_tone_weight_combination);
                updateDisplayValues(massValue, parseFloat(toneValueDisplay.textContent), config);
            });

            toneSlider.addEventListener('input', function () {
                const toneValue = parseFloat(this.value) / 100 * (toneRange[1] - toneRange[0]) + toneRange[0];
                toneValueDisplay.textContent = toneValue.toFixed(2);
                updateMorphTargets(parseFloat(massValueDisplay.textContent), toneValue, morphTargetManager, mesh, config.mass_tone_weight_combination);
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

        setupSliders(config, morphTargetManager, mesh);
        setupLightingAndShadows(BABYLON, directionalLight, shadowGenerator, scene);
        setupCheckboxes(mesh);
        setupCheckboxes(scan);

        currentScene.dispose();

        engine.runRenderLoop(() => {
            scene.render();
        });

        return scene;
    } else {
        console.error("Mesh 'm_ca01' not found in the imported GLTF.");
    }
}

export default viewerScene;
