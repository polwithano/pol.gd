const projects = 
[
    "Space Architect",
    "Zer0 Day",
    "Brutal Fighters",
    "Agent X",
    "Stellar Pulse",
    "Because I Love You",
    "Moonshine Inc."
]

async function LoadProjectData(key) 
{
    const [project, voxel] = await Promise.all([
        import(`./projects/${key}_data.json`),
        import(`./voxels/${key}_voxel.json`),
    ]);
    return {project, voxel}; 
}

async function FetchProjectsMetadata() 
{
    const time = performance.now(); 

    let metadatas = []; 
    for (let i = 0; i < projects.length; i++) 
    {
        const projectData = await import(`./projects/${projects[i]}_data.json`); 
        metadatas.push(projectData.metadata); 
    }

    const timeEnd = performance.now(); 
    const duration  = (timeEnd - time); 
    console.log(`Time taken to fetch and process metadata: ${duration} milliseconds`);

    return metadatas; 
}

export default {projects, LoadProjectData, FetchProjectsMetadata}