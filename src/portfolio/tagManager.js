const categories = {
    video_game: {
        name: "Video Game",
        shortName: "VG",
        color: "#3498db",
        fontColor: "#FFFFFF"
    },
    board_game: {
        name: "Board Game",
        shortName: "BG",
        color: "#2ecc71",
        fontColor: "#FFFFFF"
    },
    web_dev: {
        name: "Web Dev",
        shortName: "WD",
        color: "#e67e22",
        fontColor: "#FFFFFF"
    },
    programming: {
        name: "Programming",
        shortName: "PR",
        color: "#e74c3c", 
        fontColor: "#FFFFFF"
    },
    other: {
        name: "Other",
        shortName: "OT",
        color: "#9b59b6",
        fontColor: "#FFFFFF"
    }
};

function TagElement(category, type) 
{
    const categoryInfo = categories[category] || categories['other']; 

    const canvasTag = document.createElement('div'); 
    canvasTag.style.backgroundColor = categoryInfo.color;
    canvasTag.style.color = categoryInfo.fontColor;

    if (type == "tag")  
    {
        canvasTag.classList.add('tag');
        canvasTag.textContent = categoryInfo.name; 

    }
    else if (type == "small-tag") 
    {
        canvasTag.classList.add('small-tag');
        canvasTag.textContent = categoryInfo.shortName; 
    }

    return canvasTag;
}

export default {TagElement}