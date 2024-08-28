export default class Button 
{
    constructor(text = "", iconClass, onClickHandler, isToggle = false, initialState = false, additionalClassName = "") 
    {
        this.text = text;
        this.iconClass = iconClass;
        this.onClickHandler = onClickHandler;
        this.isToggle = isToggle;
        this.initialState = initialState;
        this.additionalClassName = additionalClassName; // New additional class name

        this.element = document.createElement('button');
        // Add the additional class to the button element
        this.element.className = `button ${additionalClassName}`;
        this.element.innerHTML = `<i class="${iconClass}"></i>${text}`;
        this.element.addEventListener('click', () => this.HandleButtonClick());
        this.UpdateVisualState();
    }

    HandleButtonClick()
    {
        if (this.isToggle) {
            // Toggle the state for toggle buttons
            this.state = !this.state;
            this.UpdateVisualState();

            // Call the onClickHandler if it's defined and pass the current state
            if (typeof this.onClickHandler === 'function') {
                this.onClickHandler(this.state);
            }
        } else {
            // Call the onClickHandler for non-toggle buttons
            if (typeof this.onClickHandler === 'function') {
                this.onClickHandler();
            }
        }
    }

    UpdateVisualState() {
        // Update the button's appearance based on its state for toggle buttons
        if (this.isToggle) {
            const iconElement = this.element.querySelector('i');
            const iconClass = this.state ? this.iconClassOn : this.iconClassOff;
            iconElement.className = iconClass;
            this.element.classList.toggle('active', this.state);
        }
    }

    SetGlobalPosition(left, top) {
        // Set the button's position using CSS
        this.element.style.position = 'absolute';
        this.element.style.left = left + 'px';
        this.element.style.top = top + 'px';
    }

    SetIcons(iconClassOn, iconClassOff) {
        // Set the icons for toggle buttons
        this.iconClassOn = iconClassOn;
        this.iconClassOff = iconClassOff;
        if (this.isToggle) {
            this.UpdateVisualState();
        }
    }

    AddToDOM(parentElement) {
        // Add the button to a parent DOM element
        parentElement.appendChild(this.element);
    }

    Remove() {
        // Remove the event listener before removing the button from the DOM
        this.element.removeEventListener('click', () => this.HandleButtonClick());

        // Remove the button from the DOM
        this.element.remove();
    }
}
