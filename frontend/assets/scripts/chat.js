//get chat log from db to populate chat on first load or refresh
fetch(`/getChatHistory`)
    .then(res => res.json())
    .then(data => {
        for (var i = 0; i < data.messages.length; i++) {
            addChatMessage(data.messages[i]);
        }
    })
    .catch(error => { console.error('erorr when calling fetch on getChatHistory: ', error); });

var messages = document.getElementById('messages');
var form = document.getElementById('form');
var input = document.getElementById('input');

function addChatMessage(msg) {
    var item = document.createElement('li');
    item.textContent = `${msg.username}: ${msg.message}`;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
}

form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (input.value) {
        socket.emit('chat message', input.value);
        input.value = '';
    }
});

socket.on('chat message', function (msg) {
    addChatMessage(msg)
});