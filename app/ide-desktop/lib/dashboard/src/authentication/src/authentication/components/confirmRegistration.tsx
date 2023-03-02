/** @file Registration confirmation page for when a user clicks the confirmation link set to their
 * email address. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";
import * as router from "react-router-dom";
import toast from "react-hot-toast";

import * as app from "../../components/app";
import withRouter from "../../navigation";
import * as auth from "../providers/auth";
import * as loggerProvider from "../../providers/logger";



// =================
// === Constants ===
// =================

const REGISTRATION_QUERY_PARAMS = {
    verificationCode: "verification_code",
    email: "email",
};



// ====================================
// === confirmRegistrationContainer ===
// ====================================

const confirmRegistrationContainer = () => {
    const logger = loggerProvider.useLogger();
    const { confirmSignUp } = auth.useAuth();
    const { search } = router.useLocation();
    const navigate = router.useNavigate();

    const { verificationCode, email } = parseUrlSearchParams(search);

    React.useEffect(() => {
        if (!email || !verificationCode) {
            navigate(app.LOGIN_PATH);
            return;
        }

        confirmSignUp(email, verificationCode)
            .then(() => navigate(app.LOGIN_PATH + search.toString()))
            .catch((error) => {
                logger.error("Error while confirming sign-up", error);
                toast.error(
                    "Something went wrong! Please try again or contact the administrators."
                );
                navigate(app.LOGIN_PATH);
            });
    }, []);

    return <div></div>;
};

const parseUrlSearchParams = (search: string) => {
    const query = new URLSearchParams(search);
    const verificationCode = query.get(
        REGISTRATION_QUERY_PARAMS.verificationCode
    );
    const email = query.get(REGISTRATION_QUERY_PARAMS.email);
    return { verificationCode, email };
};

export default withRouter(confirmRegistrationContainer);
