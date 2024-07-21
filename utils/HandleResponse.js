// responseUtils.js

export const notFound = (req, res, next) => {
    res.status(404).json({ message: "notfound" });
};

export const errorHandler = (error, req, res, next) => {
    const status = error.status || 400;
    const message = error.message || "Internal server error";
    res.status(status).json({ status, message, success: false });
};

export const getSuccessResponse = (status, message, user) => {
    const response = {
        status,
        message,
        success: true,
    };

    if (user) {
        response.user = user;
    }

    return response;
};
