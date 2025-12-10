import Loading from './loading';
export default function Register() {
    return (
    <>
        <div id="loadchat">
            <form
            id="register-form"
            hx-post="/register"
            hx-target="#loadchat"
            hx-swap="innerHTML"
            hx-request='\"timeout\":24000'
            >     
            <Loading/>   
            <input
                type="text"
                id="username"
                name="username"
                placeholder="Mauricio"
            />
            <button type="submit">
                Enter chat
            </button>
            </form>
        </div>
    </>
    );
}