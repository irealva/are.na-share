// https://localhost:8080/arena.html?url=thetext&title=test&text=https://www.nytimes.com/
// https://dev.are.na/users/sign_out/?redirect_uri=https%3A%2F%2Flocalhost%3A8080%2Farena.html

// Authorization settings
// https://dev.are.na/users/sign_in
// https://dev.are.na/users/sign_out
const authDomain = 'dev.are.na/oauth';
const clientID = 'fe432b6f515dc3bfe7a162c83aabb4a9fcc3d41a0a4a4bd9e1b9212d6a1629e6';

// dev vs. production
let callback;
if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    callback = 'https://localhost:8080/callback.html'
} else {
    console.log(window.location.hostname);
    callback = 'https://irealva.github.io/are.na-share/callback.html';
}

const webAuth = new auth0.WebAuth({
    domain: authDomain,
    clientID: clientID,
    redirectUri: callback,
    responseType: 'code',
    scope: ' '
});

class Arena {
    constructor(engine) {
        // Url parameters
        this.arenaID = localStorage.getItem('id');;
        this.urlToAdd = encodeURIComponent(url.searchParams.get('text')); // not getting url, getting as text
        this.titleToAdd = url.searchParams.get('title');
        this.descriptionToAdd = url.searchParams.get('url'); // not getting url, getting as text

        // There might be a new access token so refresh
        this.newAccessToken = encodeURIComponent(url.searchParams.get('access_token'));
        this.accessToken = localStorage.getItem('access_token');

        // Logic
        this.channels = [];

        // UI buttons
        this.loginSectionEl = document.querySelector('#login-section');
        this.addSectionEl = document.querySelector('#add-section');
        this.footerSectionEl = document.querySelector('.footer');
        this.arenaIdEl = document.querySelector('#arena-id');
        this.loginBtnEl = document.querySelector('#login-btn');
        this.logoutBtnEl = document.querySelector('#logout-btn');
        this.addBtnEl = document.querySelector('#add-btn');
        this.dropdownEl = document.querySelector('#dropdown');
        // UI text
        this.shareUrlEl = document.querySelector('#share-url');
        this.shareTitleEl = document.querySelector('#share-title');
        this.shareDescriptionEl = document.querySelector('#share-description');

        this.setClickListeners();
        this.setUrlParameters();
        this.handleAccessToken();
    }

    setClickListeners() {
        this.loginBtnEl.addEventListener('click', (e) => {
            // set are.na ID
            this.arenaID = this.arenaIdEl.value;
            localStorage.setItem('id', this.arenaID);

            e.preventDefault();
            webAuth.authorize();
        });

        this.logoutBtnEl.addEventListener('click', (e) => {
            localStorage.setItem('access_token', null);
            window.location = 'https://dev.are.na/users/sign_out'
        });

        this.addBtnEl.addEventListener('click', (e) => {
            const dropdownValue = this.dropdownEl.options[this.dropdownEl.selectedIndex].value;
            const channelSlug = this.channels[dropdownValue].slug;

            // update url value to whatever is in the text field
            this.urlToAdd = this.shareUrlEl.value;

            if (this.urlToAdd != "null") {
                this.updateAddButtonActive();

                console.log("Addding to channel: ", channelSlug);
                this.addBlock(channelSlug);
            }            
        });
    }

    setUrlParameters() {
        this.shareUrlEl.innerHTML = this.urlToAdd;
        this.shareTitleEl.value = this.titleToAdd;
        this.shareDescriptionEl.value = this.descriptionToAdd;
    }

    showLogin(show) {
        if (show) {
            this.showLogout(false);
            this.loginSectionEl.style.display = 'flex';
        }
        else {
            this.loginSectionEl.style.display = 'none';
        }
        
    }

    showLogout(show) {
        if (show) {
            this.logoutBtnEl.style.display = 'block';
            this.addSectionEl.style.display = 'flex';
            this.footerSectionEl.style.display = 'flex';
        }
        else {
            this.logoutBtnEl.style.display = 'none';
            this.addSectionEl.style.display = 'none';
            this.footerSectionEl.style.display = 'none';
        }
        
    }

    handleAccessToken() {
        // case 1: an access token is being updated
        if ((this.newAccessToken != "null") && (this.newAccessToken !== undefined) && (this.newAccessToken != null)) {
            console.log("CASE 1");
            localStorage.setItem("access_token", this.newAccessToken);
            this.accessToken = this.newAccessToken;

            // clear access token from url
            window.history.pushState({}, document.title, './arena.html');
            this.showLogout(true);
        }

        // wrong access token testing
        // this.accessToken = 'd56b123ee6f22c4ad0d3e183a2d58cad20120b0535618dfe4cdcc97d099bb55b';

        // case 2: we have an old access token or we just updated it
        if (this.accessToken != null) {
            console.log("CASE 2");
            this.showLogout(true);

            // we pass a callback to show login button if access token doesn't work
            this.arenaAPI = new ArenaAPI({ accessToken: this.accessToken }, this.showLogin.bind(this));

            this.getChannels();
        }
        //case 3 : first time using the app and no access token
        else {
            console.log("CASE 3");
            this.showLogin(true);
        }

    }

    getChannels() {
        console.log(this.arenaID);
        this.arenaAPI.user(this.arenaID).get()
            .then(user => {
                let channelCount = user.channel_count;
                const pageCount = Math.ceil(channelCount / 25);
                console.log("User has", channelCount, " channels");

                let promises = []

                // go through each page of channels in API Response
                for (let i = 1; i < pageCount + 1; i++) {
                    promises.push(this.fetchChannels(i));
                }

                Promise.all(promises)
                    .then(() => {
                        this.addChannelsToDropdown();
                    });
            });
    }

    fetchChannels(page) {
        const promise = new Promise((resolve, reject) => {
            this.arenaAPI.user(this.arenaID).channels({ page: page })
                .then(contents => {
                    this.saveChannels(contents);
                    resolve(contents);
                });
        });

        return promise;
    }

    saveChannels(channelsToAdd) {
        for (let channel of channelsToAdd) {
            this.channels.push({ title: channel.title, status: channel.status, slug: channel.slug })
        }
    }

    addChannelsToDropdown() {
        // alphabetize channels
        this.channels.sort(function(a, b) {
            if (a.title < b.title) return -1;
            if (a.title > b.title) return 1;
            return 0;
        })

        for (let j = 0; j < this.channels.length; j++) {
            let el = document.createElement("option");
            el.textContent = this.channels[j].title;
            el.value = j;
            this.dropdownEl.appendChild(el);
        }
    }

    addBlock(channelSlug) {
        // this contains the newly create block
        const createdBlockPromise = this.arenaAPI.block().create(channelSlug, decodeURIComponent(this.urlToAdd));

        createdBlockPromise
            .then(block => {
                // console.log(block.id)
                this.arenaAPI.block(block.id).update({
                    title: this.shareTitleEl.value,
                    description: this.shareDescriptionEl.value
                });

                this.updateAddButtonSuccess();
            })
            .catch(error => {
                alert("Block insert failed");
                console.log(error);
            });
    }

    updateAddButtonActive() {
        this.addBtnEl.innerText = "Adding...";
        this.addBtnEl.style.color = '#D5D5D5';
    }

    updateAddButtonSuccess() {
        this.addBtnEl.innerText = "Success";
        window.setTimeout(this.updateAddButtonInactive.bind(this), 1000);
    }

    updateAddButtonInactive() {
        this.addBtnEl.innerText = "Add";
        this.addBtnEl.style.color = '#999999';
    }
}

// Kick off the app and UI
const url = new URL(window.location.toString());
let app = new Arena(url);