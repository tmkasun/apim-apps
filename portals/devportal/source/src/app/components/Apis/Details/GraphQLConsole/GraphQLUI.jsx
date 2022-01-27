/*
 * Copyright (c) 2019, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, {
    useState, useEffect, useRef, useContext,
} from 'react';
import GraphiQL from 'graphiql';
import fetch from 'isomorphic-fetch';
import 'graphiql/graphiql.css';
import PropTypes from 'prop-types';
import Box from '@material-ui/core/Box';
import GraphiQLExplorer from 'graphiql-explorer';
import Collapse from '@material-ui/core/Collapse';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import { graphQLFetcher } from 'graphiql-subscriptions-fetcher/dist/fetcher';
import { ApiContext } from '../ApiContext';
import Api from '../../../../data/api';
import QueryComplexityView from './QueryComplexityView';


import Progress from '../../../Shared/Progress';

const { buildSchema } = require('graphql');

/**
 *
 * @param {*} props
 */
export default function GraphQLUI(props) {
    const {
        authorizationHeader,
        URLs,
        securitySchemeType,
        accessTokenProvider,
        additionalHeaders,

    } = props;
    const { api } = useContext(ApiContext);
    const [schema, setSchema] = useState(null);
    const [query, setQuery] = useState('');
    const [isExplorerOpen, setIsExplorerOpen] = useState(false);
    const graphiqlEl = useRef(null);
    const [open, setOpen] = React.useState(true);

    useEffect(() => {
        const apiID = api.id;
        const apiClient = new Api();
        const promiseGraphQL = apiClient.getGraphQLSchemaByAPIId(apiID);
        promiseGraphQL
            .then((res) => {
                const graphqlSchemaObj = buildSchema(res.data);
                setSchema(graphqlSchemaObj);
            });
    }, []);

    const parameters = {};

    const handleClick = () => {
        setOpen(!open);
    };


    const handleToggleExplorer = () => {
        const newExplorerIsOpen = !isExplorerOpen;
        parameters.isExplorerOpen = newExplorerIsOpen;
        setIsExplorerOpen(newExplorerIsOpen);
    };

    /**
     * Execute GraphQL query
     * @param {*} graphQLParams GraphQL query parameters
     * @returns {Promise} GraphQL query promise
     */
    function graphiQLFetcher(graphQLParams) {
        let token;
        if (authorizationHeader === 'apikey') {
            token = accessTokenProvider();
        } else if (securitySchemeType === 'BASIC') {
            token = 'Basic ' + accessTokenProvider();
        } else {
            token = 'Bearer ' + accessTokenProvider();
        }
        const headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            [authorizationHeader]: token,
        };
        const {
            additionalHeaderName,
            additionalHeaderValue,
        } = additionalHeaders;
        if (additionalHeaderName && additionalHeaderValue) {
            headers[additionalHeaderName] = additionalHeaderValue;
        }
        return fetch((URLs && URLs.https), {
            method: 'post',
            headers,
            body: JSON.stringify(graphQLParams),
        }).then((response) => response.json());
    }

    /**
     * Get subscription fetcher.
     * @param {string} wsUrl subscription websocket URL
     * @return {string} The subscription fetcher
     */
    function queryFetcher(wsUrl) {
        if (wsUrl == null) {
            return graphiQLFetcher;
        } else {
            const subscriptionsClient = new SubscriptionClient(wsUrl + '?access_token=' + accessTokenProvider(), {
                reconnect: true,
                lazy: true,
            });
            const subscriptionFetcher = graphQLFetcher(subscriptionsClient, graphiQLFetcher);
            return subscriptionFetcher;
        }
    }

    if ({ schema } === null) {
        return <Progress />;
    } else {
        return (
            <>
                <div>
                    <Box display='flex'>
                        <Box display='flex'>
                            <Collapse in={!open} timeout='auto' unmountOnExit>
                                <QueryComplexityView
                                    open={open}
                                    setOpen={setOpen}
                                />
                            </Collapse>
                        </Box>
                        <Box display='flex' width={1}>
                            <Box display='flex'>
                                <GraphiQLExplorer
                                    schema={schema}
                                    query={query}
                                    onEdit={setQuery}
                                    explorerIsOpen={isExplorerOpen}
                                    onToggleExplorer={handleToggleExplorer}
                                />
                            </Box>
                            <Box display='flex' height='800px' flexGrow={1}>
                                <GraphiQL
                                    ref={graphiqlEl}
                                    fetcher={(queryFetcher(URLs.wss))}
                                    schema={schema}
                                    query={query}
                                    onEditQuery={setQuery}
                                >
                                    <GraphiQL.Toolbar>
                                        <GraphiQL.Button
                                            onClick={() => graphiqlEl.current.handlePrettifyQuery()}
                                            label='Prettify'
                                            title='Prettify Query (Shift-Ctrl-P)'
                                        />
                                        <GraphiQL.Button
                                            onClick={() => graphiqlEl.current.handleToggleHistory()}
                                            label='History'
                                            title='Show History'
                                        />
                                        <GraphiQL.Button
                                            onClick={() => setIsExplorerOpen(!isExplorerOpen)}
                                            label='Explorer'
                                            title='Toggle Explorer'
                                        />
                                        <GraphiQL.Button
                                            onClick={handleClick}
                                            label='Complexity Analysis'
                                            title='View Field`s Complexity Values'
                                        />
                                    </GraphiQL.Toolbar>

                                </GraphiQL>
                            </Box>
                        </Box>
                    </Box>
                </div>
            </>
        );
    }
}

GraphQLUI.propTypes = {
    classes: PropTypes.shape({
        paper: PropTypes.string.isRequired,
    }).isRequired,
};
