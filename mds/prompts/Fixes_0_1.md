# Fixes for version 0.1
 - Create proper controller files for each group of routes (users, chatrooms, messages)
 - For the creation/update of users and chatrooms, use asyc calls from the front to backend, that returns a json with the result of the operation and is displayed properly in the frontend.
 - When creating a chatroom, join it automatically and show the chat interface of the chatroom.
 - The selection of image from the default images in the user profile is not working.
 - The chat interface is not working, it is not loading the messages and it is not sending any messages. The ws endpoint is not subscribed when opening the ws.
 - The interface is too much hackerman style, use more solid colors and drop the neon effects.
