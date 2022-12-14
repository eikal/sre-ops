
import React from 'react';
import Typography from "@material-ui/core/Typography";
import Box from '@material-ui/core/Box';
import PropTypes from 'prop-types';


const TabPanel = (props) => {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={props.isVertical ? `vertical-tabpanel-${index}` : `simple-tabpanel-${index}`}
            aria-labelledby={props.isVertical ? `vertical-tab-${index}` : `simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box style={{ padding: props.deletePadding ? '24px 0px 24px 0px' : null}} p={3}>
                    <Typography component={'span'}>{children}</Typography>
                </Box>
            )}
        </div>
    );
};

TabPanel.propTypes = {
    children: PropTypes.node,
    index: PropTypes.any.isRequired,
    value: PropTypes.any.isRequired,
};

export default TabPanel;
