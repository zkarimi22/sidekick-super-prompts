console.log("Recipes Extension: Content script loaded.");

let allPrompts = [];
let sidekickInputContainer = null;
let sidekickTextarea = null;
let tagSelector = null;  
let pillContainer = null;  
let closeButton = null;  
let outerContainer = null;  
let tagCounts = {}; // Add variable to store tag counts

// --- Core Functions ---

async function fetchPrompts() {
  try {
    
    const response = await fetch(chrome.runtime.getURL('prompts.json'));
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    allPrompts = await response.json();
    console.log("Recipes Extension: Prompts loaded:", allPrompts);
    // Load tag counts after prompts are loaded
    await loadTagCounts();
    return allPrompts;
  } catch (error) {
    console.error("Recipes Extension: Failed to fetch prompts:", error);
    return [];  
  }
}

// Add function to load counts from storage
async function loadTagCounts() {
  try {
    const data = await chrome.storage.local.get(['tagCounts']);
    tagCounts = data.tagCounts || {};
    console.log("Recipes Extension: Loaded tag counts:", tagCounts);
  } catch (error) {
    console.error("Recipes Extension: Error loading tag counts:", error);
    tagCounts = {}; // Default to empty if error
  }
}

// Add function to save counts to storage
async function saveTagCounts() {
  try {
    await chrome.storage.local.set({ tagCounts });
    console.log("Recipes Extension: Saved tag counts:", tagCounts);
  } catch (error) {
    console.error("Recipes Extension: Error saving tag counts:", error);
  }
}

function getUniqueTags(prompts) {
  const tags = new Set();
  prompts.forEach(prompt => {
     
    if (prompt.tags && Array.isArray(prompt.tags)) {
      prompt.tags.forEach(tag => tags.add(tag));
    }
  });
   
  // Sort tags based on counts before returning
  return [...tags].sort((a, b) => {
    const countA = tagCounts[a] || 0;
    const countB = tagCounts[b] || 0;
    return countB - countA; // Sort descending by count
  });
}

function createUI(tags) {
  if (!sidekickInputContainer) {
    console.error("Recipes Extension: Sidekick input container not found for UI creation.");
    return;
  }
  // Prevent creating UI multiple times
  if (document.getElementById('recipes-container')) {
    console.log("Recipes Extension: UI already exists.");
    return;
  }

  console.log("Recipes Extension: Creating UI using Sidekick styles.");

  outerContainer = document.createElement('div'); 
  outerContainer.id = 'recipes-container';
  

 //select container
  tagSelector = document.createElement('select');
  tagSelector.id = 'recipes-tag-selector';
  const placeholderOption = document.createElement('option');
  placeholderOption.value = "";
  placeholderOption.textContent = "Select a super prompt...";
  placeholderOption.disabled = true;
  placeholderOption.selected = true;
  tagSelector.appendChild(placeholderOption);
  tags.forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    // would adding a count be valuable? 
    const count = tagCounts[tag] || 0;
    option.textContent = count > 0 ? `${tag}` : tag; // should i show count? maybe not..
    tagSelector.appendChild(option);
  });
  outerContainer.appendChild(tagSelector);

  // creating the pill container 
  pillContainer = document.createElement('div');
  pillContainer.id = 'recipes-pill-container';
  pillContainer.className = '_Container_ircu9_1';
  pillContainer.classList.add('hidden');
  outerContainer.appendChild(pillContainer);

  // should have a close button i suppose. 
  closeButton = document.createElement('button');
  closeButton.id = 'recipes-close-pills';
  closeButton.innerHTML = '&times;';
  closeButton.title = 'Clear selected tag';
  closeButton.classList.add('hidden');
  outerContainer.appendChild(closeButton);

  // recipes-container looks best above the input.. so changing to parent
  if (sidekickInputContainer && sidekickInputContainer.parentNode) {
    sidekickInputContainer.parentNode.insertBefore(outerContainer, sidekickInputContainer);
    console.log("Recipes Extension: UI Injected directly before input container.");

    
    if (sidekickTextarea) {
     
      if (!sidekickTextarea.listenerAttached) {
          sidekickTextarea.addEventListener('input', handleTextareaInput);
          sidekickTextarea.listenerAttached = true; // Flag it
      }
    } else {
        console.warn("Recipes Extension: Textarea not found for input listener after injection.");
    }

  } else {
      console.error("Recipes Extension: Cannot inject UI - input container or its parent not found.");
      return;  
  }
   
  tagSelector.addEventListener('change', handleTagSelection);
  pillContainer.addEventListener('click', (event) => {
    const button = event.target.closest('._PillWrapper_ircu9_38');
    if (button) {
      handlePillClick(button);
    }
  });
  closeButton.addEventListener('click', handleClosePills);

  console.log("Recipes Extension: UI Created and Initialized (Sidekick Styles).");
 
  handleTextareaInput();
}

 

function handleTagSelection(event) {
   
    if (!pillContainer || !closeButton) {
        console.error("Recipe Extension: Pill container or close button not found during tag selection.");
        return;
    }
    const selectedTag = event.target.value;
    pillContainer.innerHTML = '';  

    if (selectedTag) {
        const matchingPrompts = allPrompts.filter(p => p.tags && p.tags.includes(selectedTag));

        if (matchingPrompts.length > 0) {
            matchingPrompts.forEach(promptData => {
                
                const spanWrapper = document.createElement('span');
                

                const pillButton = document.createElement('button');
                pillButton.className = '_PillWrapper_ircu9_38';  
                pillButton.type = 'button';
                pillButton.textContent = promptData.prompt || 'prompt';
                pillButton.title = promptData.prompt || 'No prompt text';
                pillButton.dataset.prompt = promptData.prompt || '';
                 
                pillButton.setAttribute('tabindex', '0');
                

                spanWrapper.appendChild(pillButton);
                pillContainer.appendChild(spanWrapper);
            });
            pillContainer.classList.remove('hidden');
            closeButton.classList.remove('hidden');
          
             if (outerContainer && sidekickTextarea && sidekickTextarea.value.trim().length <= 1) {
                outerContainer.classList.remove('hidden');
            }
        } else {
            pillContainer.classList.add('hidden');
            closeButton.classList.add('hidden');
        }
    } else {
         
        pillContainer.classList.add('hidden');
        closeButton.classList.add('hidden');
    }

    // Increment count for the selected tag
    if (selectedTag) {
        tagCounts[selectedTag] = (tagCounts[selectedTag] || 0) + 1;
        saveTagCounts();  
    }
}

function handlePillClick(pillButtonElement) { 
    const promptText = pillButtonElement.dataset.prompt;

     if (promptText && sidekickTextarea) {
        console.log("Recipes Extension: Inserting prompt:", promptText);
        sidekickTextarea.value = promptText; // Set the value

         //input event
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        sidekickTextarea.dispatchEvent(inputEvent);  

        sidekickTextarea.focus();  

         // after clicking hide the ui 
         if (outerContainer) {
            outerContainer.classList.add('hidden');
            console.log("Recipes Extension: Hiding UI after pill click.");
        }
      

      } else {
          console.warn("Recipe Extension: Could not insert prompt. Text or textarea missing.", { promptText, sidekickTextarea });
      }
}

 
function resetUIState() {
    if (tagSelector) {
        tagSelector.selectedIndex = 0;  
    }
    if (pillContainer) {
        pillContainer.innerHTML = '';  
        pillContainer.classList.add('hidden');
    }
    if (closeButton) {
        closeButton.classList.add('hidden');
    }
     console.log("Recipes Extension: UI State Reset.");
}

 
function handleClosePills() {
  console.log("Recipes Extension: Close button clicked.");
  resetUIState();
  
}

 
function handleTextareaInput() {
    if (!sidekickTextarea || !outerContainer) return;  

    const textLength = sidekickTextarea.value.trim().length;
     

    if (textLength <= 1) {
        
        outerContainer.classList.remove('hidden');
         
        if (pillContainer && !pillContainer.classList.contains('hidden')) {
             resetUIState();
        }
         
    } else {
         
        outerContainer.classList.add('hidden');
       
    }
}


 //init functions 

function findSidekickElements() {
  // seems like the name attr is the most reliable to target.. Will change if i see this dynamically update 
  sidekickTextarea = document.querySelector('textarea[name="sidekickMessage"]');

  if (sidekickTextarea) {
     
    sidekickInputContainer = sidekickTextarea.closest('._InputContainer_1amny_56');
    // If the specific container isn't found, fall back to parent element
    if (!sidekickInputContainer) {
      sidekickInputContainer = sidekickTextarea.parentElement;
      console.warn("Recipes Extension: Could not find specific '_InputContainer_1amny_56'. Using parentElement as fallback.");
    }
     
     outerContainer = document.getElementById('recipes-container');

  } else {
    // gracefully reset if cant be found 
    sidekickTextarea = null;
    sidekickInputContainer = null;
    outerContainer = null;
  }

   
  return !!sidekickTextarea && !!sidekickInputContainer;
}

 
const observer = new MutationObserver((mutationsList, observerInstance) => {
  let nodesAdded = mutationsList.some(mutation => mutation.addedNodes.length > 0);
  if (nodesAdded || !document.getElementById('recipes-container')) {
       if (findSidekickElements()) {
            console.log("Recipes Extension: Sidekick elements found!");
            observerInstance.disconnect();
            if (!document.getElementById('recipes-container')) {
                 // Fetch prompts (which now also loads counts)
                 fetchPrompts().then(prompts => {
                    if (prompts && prompts.length > 0) {
                        // Get tags (which are now sorted by count)
                        const uniqueTags = getUniqueTags(prompts);
                        createUI(uniqueTags); // Create UI with sorted tags
                    } else {
                        console.log("Recipes Extension: No prompts loaded or error fetching, UI not created.");
                    }
                }).catch(err => console.error("Recipes Extension: Error during init fetch/UI creation:", err)); // Add catch block
            } else {
                 
                 if (sidekickTextarea && !sidekickTextarea.listenerAttached) {  
                     sidekickTextarea.addEventListener('input', handleTextareaInput);
                     sidekickTextarea.listenerAttached = true;  
                 }
                 handleTextareaInput();
            }
            clearTimeout(fallbackTimer);
            clearInterval(checkInterval);
       }
  }
});

 
console.log("Recipes Extension: Starting MutationObserver to find Sidekick input.");
observer.observe(document.body, {
  childList: true,  
  subtree: true   
});
 
let checkInterval;
let fallbackTimer;

function startFallbackCheck() {
    checkInterval = setInterval(() => {
        if (findSidekickElements()) {
            console.log("Recipes Extension: Sidekick elements found via fallback interval.");
            clearInterval(checkInterval);
            observer.disconnect();
             if (!document.getElementById('recipes-container')) {
                 // Fetch prompts (which now also loads counts)
                 fetchPrompts().then(prompts => {
                    if (prompts && prompts.length > 0) {
                        // Get tags (which are now sorted by count)
                        const uniqueTags = getUniqueTags(prompts);
                        createUI(uniqueTags); // Create UI with sorted tags
                    } else {
                        console.log("Recipes Extension: No prompts loaded or error fetching (fallback), UI not created.");
                    }
                 }).catch(err => console.error("Recipes Extension: Error during fallback fetch/UI creation:", err)); // Add catch block
            } else {
                 
                 if (sidekickTextarea && !sidekickTextarea.listenerAttached) {  
                     sidekickTextarea.addEventListener('input', handleTextareaInput);
                     sidekickTextarea.listenerAttached = true; 
                 }
                 handleTextareaInput();
            }
        }
    }, 1500);

    fallbackTimer = setTimeout(() => {
        clearInterval(checkInterval);
    }, 30000);
}

 
setTimeout(startFallbackCheck, 500); 