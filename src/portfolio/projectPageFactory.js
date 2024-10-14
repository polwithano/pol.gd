import ICON from '../../public/media/portfolio-icons/masterICON';
import JSON from '../../data/masterJSON'
import gsap from 'gsap';

export default class ProjectPageFactory 
{
    constructor(container) 
    {
        this.container = container; 
        this.Initialize(); 
    }

    async Initialize() 
    {
        this.placeholderImage = await ICON.LoadIcon('placeholder'); 
        this.arrowHeader = await ICON.LoadIcon('back'); 
 
        this.videoElements = [];
        this.container.innerHTML = ''; 

        this.isOpen = false; 
        this.animation = this.SetupPageAnimation(); 
    }

    async CreatePage(object) 
    {
        if (this.container === undefined) 
        {
            console.error('ProjectPageFactory: project page container is undefined');
            return;  
        }

        const data = object.content; 

        const urls = JSON.FetchAssetURL(object.data.project); 

        this.container.innerHTML = ''; 
        this.videoElements = []; 
        
        const header = this.RenderHeader(data, urls[0]); 
        this.container.appendChild(header); 

        const backButton = header.querySelector('.back-button');
        if (backButton) 
        {
            backButton.addEventListener('click', () => {
                this.ClosePage(); // Replace with the actual method or logic for going back
            });
        }

        let imageIndex = 1; 

        data.sections.forEach((section) => 
        {
            let div = null;
            
            switch (section.type) 
            {
                case 'text-image':
                    div = this.RenderTextImageSection(section, urls[imageIndex]);
                    imageIndex++; 
                    break;
                case 'gif':
                    div = this.RenderGifSection(section, urls[imageIndex]); 
                    imageIndex++; 
                    break; 
                case 'video': 
                    div = this.RenderVideoSection(section, 640, 360); 
                    const iframe = div.querySelector('iframe'); 
                    this.videoElements.push(iframe); 
                    break; 
                case 'category':
                    div = this.RenderCategorySection(section); 
                    break; 
                case 'spacer':
                    div = this.RenderSpacerSection(section); 
                    break; 
                default: 
                    console.error(`Unknown section type: ${section.type}`); 
                    break; 
            }

            if (div != null) 
            {
                div.className += 'content-section'; 
                this.container.appendChild(div);
            } 
        })

        if (data.download) 
        {
            const downloadSection = this.RenderDownloadSection(data.download);
            this.container.appendChild(downloadSection);
        }
        
        this.container.classList.remove('hidden');
    }

    SetupPageAnimation() 
    {
        const duration = 0.05; 
        
        const overlay = document.getElementById('darkOverlay'); 
        const container = document.getElementById('project-container'); 
        const description = document.getElementById('project-description')

        const animation = gsap.timeline
        ({
            paused: true, 
            ease: "expo.inOut", 
            onComplete: () => 
            {
                container.classList.add('visible');
                container.classList.remove('hidden'); 
                container.style.pointerEvents = 'auto';  
                description.style.pointerEvents = 'none'; 
            },
            onReverseComplete: () => 
            {
                container.classList.remove('visible');
                container.classList.add('hidden'); 
                container.style.pointerEvents = 'none';
                description.style.pointerEvents = 'auto'; 
            }
        })

        animation.to(overlay, 
        {
            duration: duration,
            opacity: '.95', 
        })
        .to(description, 
        {
            duration: duration,
            opacity: '0'
        })
        .to(container, 
        {
            duration: duration, 
            opacity: '1'
        }); 

        return animation; 
    }

    OpenPage() 
    {
        this.animation.timeScale(1).play(); 
        this.isOpen = true; 
    }

    ClosePage() 
    {
        this.animation.timeScale(1.33).reverse(); 
        this.isOpen = false; 
    }

    RenderHeader(data, image) 
    {
        const div = document.createElement('div'); 
        const background = image || this.placeholderImage.default;
        const arrow = this.arrowHeader.default || this.placeholderImage.default; 

        div.className = 'project-header';
        div.style.backgroundImage = `linear-gradient(to top, rgba(0, 0, 0, 0.99), rgba(0, 0, 0, 0)), url('${background}')`; 
        div.innerHTML = `
            <button class="back-button">
                <img src=${arrow} alt="Back" class="back-icon">
            </button>
            <h1 class="project-title">${data.title}</h1>
            <p class="project-tagline">${data.tagline}</p>
            <p class="content-spacer"></p>
        `;

        return div; 
    }

    RenderTextImageSection(section, image) 
    {
        const div = document.createElement('div');
        const asset = image || this.placeholderImage.default; 

        div.innerHTML = `
            <img loading="lazy" src="${asset}" alt="${section.content.image.alt}" class="content-image ${section.content.image.position}">
            <p class="content-paragraph">${section.content.paragraph}</p>
        `;

        return div; 
    }

    RenderGifSection(section, image) 
    {
        const div = document.createElement('div');
        const asset = image || this.placeholderImage.default; 
        const legend = section.content.legend || ''; 
        const width = section.content.image.width || 'auto'; // Default to 'auto' if not provided
        const height = section.content.image.height || 'auto'; // Default to 'auto' if not provided    

        div.className = 'gif-section'; 
        div.innerHTML = `
            <img loading="lazy" src="${asset}" alt="GIF" class="content-gif" style="width: ${width}px; height: ${height}px;">
            ${legend ? `<p class="gif-legend">${legend}</p>` : ''}
        `;

        return div; 
    }

    RenderVideoSection(section, width, height) 
    {
        const div = document.createElement('div'); 

        div.innerHTML = `
        <div class="video-section">
            <iframe width="${width}" height="${height}" src="https://www.youtube.com/embed/${section.content.videoId}?enablejsapi=1" frameborder="0" allowfullscreen></iframe>
            <p class="content-subtitle">${section.content.caption || ''}</p>
        </div>
        `;
        return div; 
    }

    RenderCategorySection(section) 
    {
        const div = document.createElement('div'); 

        div.innerHTML = `
            <div class="category-section">
                <h2 class="category-title">${section.content.title}</h2>
            </div>
        `;
        return div; 
    }

    RenderSpacerSection(section) 
    {
        const div = document.createElement('div'); 
        const spacerHeight = section?.content?.height || 20; 
        
        div.innerHTML = `<p class="content-paragraph content-spacer" style="height: ${spacerHeight}px;"></p>`;
        
        return div; 
    }

    RenderDownloadSection(download) 
    {
        const div =  document.createElement('div'); 

        div.className = 'download-section'; 
        div.innerHTML = `<a href="${download.url}" target="_blank" class="download-button">${download.label}</a>`;

        return div; 
    }

    PauseVideos() 
    {
        this.videoElements.forEach(video => 
        {
            // Log the current video and its source
            const src = video.src || video.getAttribute('src');
            console.log('Pausing video with source:', src);
            
            if (video.contentWindow) 
            {
                // Send the pause command to the video
                video.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');        
                console.log('Pause command sent to video.');
            } 
            else console.error('No contentWindow available for video:', video);
        });
    }
    
}