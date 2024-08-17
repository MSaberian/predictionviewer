import viewerScene from "./viewerScene"
import viewerSceneOld from "./viewerSceneOld"

let scene = undefined
async function main(BABYLON, engine, currentScene) {
    
    scene = await viewerScene(BABYLON, engine, currentScene)

    engine.runRenderLoop(() => {
        scene.render()
    })
}

export default main
