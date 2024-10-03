const projects = 
[
    "Space Architect",
    "Zer0 Day",
    "Brutal Fighters",
    "Agent X",
    "Stellar Pulse",
    "Because I Love You",
    "Moonshine Inc.",
    "pol.gd",
    "Tile Editor",
    "Raycaster"
]

async function LoadProjectData(key) 
{
    const [project, voxel] = await Promise.all([
        import(`./projects/${key}_data.json`),
        import(`./voxels/${key}_voxel.json`),
    ]);
    return {project, voxel}; 
}

async function LoadProjectAssets(projectData) 
{
    try 
    {
        const { content, metadata } = projectData;
        const contentFolder = metadata.contentFolder || 'default-folder'; 
        const mediaBasePath = `../media/projects/${contentFolder}`;

        async function loadImageWithFallback(basePath, imageName) {
            const possibleExtensions = ['.jpg', '.gif', '.png', '.webp'];
            
            return new Promise((resolve, reject) => {
                let imageLoaded = false;
        
                for (const ext of possibleExtensions) {
                    const src = `${basePath}/${imageName}${ext}`;
                    
                    // Create an image element and check for load/error events
                    const img = new Image();
                    img.src = src;
        
                    img.onload = () => {
                        if (!imageLoaded) {
                            console.log(`${ext} file loaded sucessfully: ${src}`);
                            imageLoaded = true;
                            resolve(src); // Resolve with the correct image path
                        }
                    };
        
                    img.onerror = () => {
                        //console.warn('Failed to load image:', src);
                        // If it's the last extension and none worked, reject
                        if (ext === possibleExtensions[possibleExtensions.length - 1] && !imageLoaded) {
                            resolve('../public/media/placeholder-image.jpg'); // Resolve with placeholder as fallback
                        }
                    };
                }
            });
        }
        
        // Load header image with fallback for various extensions
        const header = await loadImageWithFallback(mediaBasePath, content.header || 'header-image');

        // Filter and load images for each section
        const images = await Promise.all(
            content.sections
                .filter(section => 
                    (section.type === 'text-image' || section.type === 'gif') 
                    && section.content.image && section.content.image.imageIndex)
                .map(async (section) => {
                    const index = section.content.image.imageIndex; 
                    const image = await loadImageWithFallback(mediaBasePath, index);

                    return {
                        ...section.content.image, 
                        src: image
                    };
                })
        );

        return { header, images };
    } 
    catch (error) 
    {
        console.error('Error loading project assets:', error);
        return null;  
    }
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

export default {projects, LoadProjectData, LoadProjectAssets, FetchProjectsMetadata}