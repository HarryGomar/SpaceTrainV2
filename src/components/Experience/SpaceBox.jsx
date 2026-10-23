import {useEffect} from 'react';
import {useCubeTexture} from '@react-three/drei';
import { useThree } from "@react-three/fiber";

export default function SpaceBox() {
    const scene = useThree(state=>state.scene);
    const texture = useCubeTexture(['right.png','left.png','top.png','bottom.png','front.png','back.png'],{path:'/SkyboxTextures/'});
    useEffect(()=>{
        const previous=scene.background;
        scene.background=texture;
        return ()=>{scene.background=previous;};
    },[scene,texture]);

    return null;
}
