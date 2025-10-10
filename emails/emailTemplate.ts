export const sendFormResponseEmailTemplate = (
  formName: string,
  projectName: string,
  message: string,
  name: string,
  email: string
): string =>
  `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />    
  </head>


          <body
            style='background-color:rgb(243,244,246);display:flex;width:100%;justify-content:center;align-items:center;margin:0px;padding:0px;font-family:ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";font-size:1rem;line-height:1.5rem;padding-top:3rem;padding-bottom:3rem'
          >
      <table
        align="center"
        width="100%"
        border="0"
        cellpadding="0"
        cellspacing="0"
        role="presentation"
        style="background-color:rgb(255,255,255);max-width:42rem;width:100%;padding-left:2.5rem;padding-right:2.5rem;padding-top:2rem;padding-bottom:2rem;border-radius:0.125rem;border:1px solid #0000001a"
      >
        <tbody>
          <tr style="width:100%">
            <td>
              <table
                align="center"
                width="100%"
                border="0"
                cellpadding="0"
                cellspacing="0"
                role="presentation"
                style="width:100%"
              >
                <tbody>
                  <tr>
                    <td>
                      <h2
                        style="font-size:1.5rem;line-height:2rem;font-weight:700;margin-bottom:1rem"
                      >
                       ${message}
                      </h2>

                      <div style="margin-top:1.5rem">
                        <div style="margin-bottom:1.25rem">
                          <h3
                            style="font-size:0.75rem;line-height:1rem;color:rgb(156,163,175);font-weight:500;margin-bottom:0.5rem"
                          >
                            名前
                          </h3>
                          <p
                            style="padding-bottom:0.75rem;border-bottom:1px solid #0000001a"
                          >
                            ${name} 
                          </p>
                        </div>
                        <div style="margin-bottom:1.25rem">
                          <h3
                            style="font-size:0.75rem;line-height:1rem;color:rgb(156,163,175);font-weight:500;margin-bottom:0.5rem"
                          >
                            メールアドレス
                          </h3>
                          <a
                            style="color:rgb(59,130,246);padding-bottom:0.75rem;border-bottom:1px solid #0000001a"
                            href="mailto:frontend-dev-002@wecode-inc.com"
                            >                            ${email}</a
                          >
                        </div>
                        <div style="margin-bottom:1.25rem">
                          <h3
                            style="font-size:0.75rem;line-height:1rem;color:rgb(156,163,175);font-weight:500;margin-bottom:0.5rem"
                          >
                            電話番号
                          </h3>
                          <p
                            style="padding-bottom:0.75rem;border-bottom:1px solid #0000001a"
                          >
                          </p>
                        </div>
                        <div style="margin-bottom:1.25rem">
                          <h3
                            style="font-size:0.75rem;line-height:1rem;color:rgb(156,163,175);font-weight:500;margin-bottom:0.5rem"
                          >
                            お問い合わせ内容
                          </h3>
                          <p
                            style="padding-bottom:0.75rem;border-bottom:1px solid #0000001a;white-space:pre-line"
                          >
                          </p>
                        </div>
                      </div>
                      <div style="margin-top:1.75rem">
                        <a
                          href="#"
                          style="background-color:rgb(0,0,0);color:rgb(255,255,255);padding-top:0.5rem;padding-bottom:0.5rem;padding-left:1rem;padding-right:1rem;border-radius:0.25rem;display:inline-block;line-height:100%;text-decoration:none;max-width:100%;mso-padding-alt:0px;padding:8px 16px 8px 16px"
                          target="_blank"
                          ><span
                            ><!--[if mso
                              ]><i
                                style="mso-font-width:400%;mso-text-raise:12"
                                hidden
                                >&#8202;&#8202;</i
                              ><!
                            [endif]--></span
                          ><span
                            style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:6px"
                            >Open in dashboard</span
                          ><span
                            ><!--[if mso
                              ]><i style="mso-font-width:400%" hidden
                                >&#8202;&#8202;&#8203;</i
                              ><!
                            [endif]--></span
                          ></a
                        >
                           </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
            <!--/$-->
          </body>
        </html>

        `
