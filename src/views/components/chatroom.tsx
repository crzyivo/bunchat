export default function Chatroom() {
    return (
    <>
    <div hx-ext="ws" ws-connect="/chatroom">
    <div id="chat_room">
        ...
    </div>
        <form ws-send>
            <input name="chat_message"/>
            <button type="submit">Send</button>
        </form>
    </div>
    </>
    );
}