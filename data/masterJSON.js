const projects = 
[
    "Space Architect",
    "Zer0 Day",
    "Brutal Fighters",
    "Stellar Pulse"
]

async function LoadProjectData(key) 
{
    if (key == 'Space Architect') 
    {
        const [project, voxel] = await Promise.all([
            import('./projects/Space Architect_data.json'), 
            import('./voxels/Space Architect_voxel.json')
        ]);
        return {project, voxel}; 
    }
    if (key == 'Zer0 Day') 
    {
        const [project, voxel] = await Promise.all([
            import('./projects/Zer0 Day_data.json'), 
            import('./voxels/Zer0 Day_voxel.json')
        ]);
        return {project, voxel}; 
    }
    if (key == 'Brutal Fighters') 
    {
        const [project, voxel] = await Promise.all([
            import('./projects/Brutal Fighters_data.json'), 
            import('./voxels/Brutal Fighters_voxel.json')
        ]);
        return {project, voxel}; 
    }
    if (key == 'Stellar Pulse') 
    {
        const [project, voxel] = await Promise.all([
            import('./projects/Stellar Pulse_data.json'), 
            import('./voxels/Stellar Pulse_voxel.json')
        ]);
        return {project, voxel}; 
    }
}

export default {projects, LoadProjectData}